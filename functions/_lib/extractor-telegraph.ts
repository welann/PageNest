import {
  buildTelegraphIndexNodes,
  buildTelegraphPartNodes,
  buildTelegraphPartTitle,
  splitTelegraphBlocks,
  summarizeExtractorSelection
} from "../../src/shared/extractor/telegraph";
import type {
  ExtractorTelegraphPublishRequest,
  ExtractorTelegraphPublishResult,
  ExtractorTelegraphSettingsStatus
} from "../../src/shared/types/extractor";
import { ReaderHttpError } from "./extractor-data";

const SETTINGS_KEY = "extractor.telegraph.account";
const TELEGRAPH_API_BASE = "https://api.telegra.ph";

interface TelegraphApiEnvelope<T> {
  error?: string;
  ok: boolean;
  result?: T;
}

interface StoredTelegraphSettings {
  accessToken: string;
  authorName: string | null;
  authorUrl: string | null;
  shortName: string | null;
  updatedAt: string;
}

interface TelegraphAccountInfo {
  author_name?: string;
  author_url?: string;
  short_name?: string;
}

interface TelegraphPageResult {
  path: string;
  url: string;
}

function normalizeOptionalValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function sanitizeAssetName(name: string, fallback: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || fallback;
}

function maskSettings(settings: StoredTelegraphSettings | null): ExtractorTelegraphSettingsStatus {
  return {
    configured: Boolean(settings?.accessToken),
    shortName: settings?.shortName ?? null,
    authorName: settings?.authorName ?? null,
    authorUrl: settings?.authorUrl ?? null,
    updatedAt: settings?.updatedAt ?? null
  };
}

function isLocalOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return true;
  }
}

function parseStoredSettings(valueJson: string | null): StoredTelegraphSettings | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as Record<string, unknown>;
    const accessToken = normalizeOptionalValue(parsed.accessToken);

    if (!accessToken) {
      return null;
    }

    return {
      accessToken,
      authorName: normalizeOptionalValue(parsed.authorName),
      authorUrl: normalizeOptionalValue(parsed.authorUrl),
      shortName: normalizeOptionalValue(parsed.shortName),
      updatedAt: normalizeOptionalValue(parsed.updatedAt) ?? new Date().toISOString()
    };
  } catch {
    return null;
  }
}

async function callTelegraph<T>(path: string, body: URLSearchParams) {
  const response = await fetch(`${TELEGRAPH_API_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new ReaderHttpError(`Telegraph request failed with status ${response.status}.`, 502);
  }

  const payload = (await response.json()) as TelegraphApiEnvelope<T>;

  if (!payload.ok || !payload.result) {
    throw new ReaderHttpError(payload.error ?? "Telegraph request was rejected.", 502);
  }

  return payload.result;
}

async function getStoredTelegraphSettings(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_settings
        WHERE key = ?
        LIMIT 1
      `
    )
    .bind(SETTINGS_KEY)
    .first<{ valueJson: string | null }>();

  return parseStoredSettings(result?.valueJson ?? null);
}

async function upsertTelegraphSettings(db: D1Database, settings: StoredTelegraphSettings) {
  await db
    .prepare(
      `
        INSERT INTO app_settings (key, value_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at
      `
    )
    .bind(SETTINGS_KEY, JSON.stringify(settings), settings.updatedAt)
    .run();
}

export async function getTelegraphSettingsStatus(db: D1Database) {
  return maskSettings(await getStoredTelegraphSettings(db));
}

export async function saveTelegraphSettings(
  db: D1Database,
  input: {
    accessToken: string;
    authorName?: string | null;
    authorUrl?: string | null;
    shortName?: string | null;
  }
) {
  const existing = await getStoredTelegraphSettings(db);
  const accessToken = normalizeOptionalValue(input.accessToken) ?? existing?.accessToken ?? null;

  if (!accessToken) {
    throw new ReaderHttpError("Telegraph access token is required.", 400);
  }

  const accountInfo = await callTelegraph<TelegraphAccountInfo>(
    "getAccountInfo",
    new URLSearchParams({
      access_token: accessToken,
      fields: JSON.stringify(["short_name", "author_name", "author_url"])
    })
  );
  const timestamp = new Date().toISOString();
  const settings: StoredTelegraphSettings = {
    accessToken,
    shortName: normalizeOptionalValue(input.shortName) ?? normalizeOptionalValue(accountInfo.short_name),
    authorName: normalizeOptionalValue(input.authorName) ?? normalizeOptionalValue(accountInfo.author_name),
    authorUrl: normalizeOptionalValue(input.authorUrl) ?? normalizeOptionalValue(accountInfo.author_url),
    updatedAt: timestamp
  };

  await upsertTelegraphSettings(db, settings);

  return maskSettings(settings);
}

async function createTelegraphPage(
  settings: StoredTelegraphSettings,
  title: string,
  content: unknown[]
) {
  return callTelegraph<TelegraphPageResult>(
    "createPage",
    new URLSearchParams({
      access_token: settings.accessToken,
      title,
      content: JSON.stringify(content),
      return_content: "false",
      ...(settings.authorName ? { author_name: settings.authorName } : {}),
      ...(settings.authorUrl ? { author_url: settings.authorUrl } : {})
    })
  );
}

async function editTelegraphPage(
  settings: StoredTelegraphSettings,
  path: string,
  title: string,
  content: unknown[]
) {
  return callTelegraph<TelegraphPageResult>(
    "editPage",
    new URLSearchParams({
      access_token: settings.accessToken,
      path,
      title,
      content: JSON.stringify(content),
      return_content: "false",
      ...(settings.authorName ? { author_name: settings.authorName } : {}),
      ...(settings.authorUrl ? { author_url: settings.authorUrl } : {})
    })
  );
}

export async function publishToTelegraph(
  db: D1Database,
  bucket: R2Bucket,
  origin: string,
  payload: ExtractorTelegraphPublishRequest,
  filesByAssetId: Map<string, File>
): Promise<ExtractorTelegraphPublishResult> {
  if (!payload.blocks.length) {
    throw new ReaderHttpError("No extracted blocks are available for Telegraph publishing.", 400);
  }

  const settings = await getStoredTelegraphSettings(db);

  if (!settings) {
    throw new ReaderHttpError("Telegraph is not configured for this workspace yet.", 409);
  }

  if (filesByAssetId.size > 0 && isLocalOrigin(origin)) {
    throw new ReaderHttpError(
      "Image publishing requires a publicly reachable site origin; localhost assets cannot be fetched by Telegraph.",
      409
    );
  }

  const warnings: string[] = [];
  const jobId = crypto.randomUUID();
  const assetUrls = new Map<string, string>();
  const descriptors = new Map(payload.assets.map((asset) => [asset.assetId, asset]));

  for (const [assetId, file] of filesByAssetId) {
    const descriptor = descriptors.get(assetId);
    const safeName = sanitizeAssetName(
      descriptor?.fileName ?? file.name,
      `asset-${assetUrls.size + 1}.${(descriptor?.mimeType ?? file.type).split("/").at(-1) ?? "bin"}`
    );
    const storageKey = `telegraph-assets/${jobId}/${safeName}`;

    await bucket.put(storageKey, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: descriptor?.mimeType || file.type || "application/octet-stream"
      }
    });

    assetUrls.set(assetId, `${origin.replace(/\/$/, "")}/api/extractor/telegraph/assets/${jobId}/${safeName}`);
  }

  for (const block of payload.blocks) {
    if (block.type === "image" && !assetUrls.has(block.assetId)) {
      warnings.push(`Image asset ${block.assetId} was missing from the publish request.`);
    }
  }

  const partBlocks = splitTelegraphBlocks(payload.blocks, assetUrls);

  if (!partBlocks.length) {
    throw new ReaderHttpError("No Telegraph content could be generated from the selected result.", 400);
  }

  const partPages = [];

  for (const [index, blocks] of partBlocks.entries()) {
    const title = buildTelegraphPartTitle(
      payload.documentTitle,
      payload.selectionSummary,
      partBlocks.length > 1 ? index + 1 : undefined
    );
    const content = buildTelegraphPartNodes(blocks, assetUrls);
    const page = await createTelegraphPage(settings, title, content);

    partPages.push({
      partNumber: index + 1,
      path: page.path,
      title,
      url: page.url
    });
  }

  let indexPageUrl: string | null = null;
  let indexPagePath: string | null = null;

  if (partPages.length > 1) {
    const indexTitle = `${payload.documentTitle} · ${summarizeExtractorSelection(payload.selectionSummary)} · Index`;
    const indexPage = await createTelegraphPage(
      settings,
      indexTitle,
      buildTelegraphIndexNodes(payload.documentTitle, payload.selectionSummary, partPages)
    );

    indexPageUrl = indexPage.url;
    indexPagePath = indexPage.path;

    await Promise.all(
      partPages.map((part, index) =>
        editTelegraphPage(
          settings,
          part.path,
          part.title,
          buildTelegraphPartNodes(partBlocks[index], assetUrls, indexPage.url)
        )
      )
    );
  }

  return {
    indexPagePath,
    indexPageUrl,
    partPages,
    publishedAt: new Date().toISOString(),
    warnings
  };
}
