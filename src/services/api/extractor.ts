import type {
  ExtractorBootstrap,
  ExtractorDocumentSummary,
  ExtractorTelegraphPublishRequest,
  ExtractorTelegraphPublishResult,
  ExtractorTelegraphSettingsStatus
} from "@shared/types/extractor";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Extractor request failed.";

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function getExtractorBootstrap(signal?: AbortSignal) {
  const response = await fetch(`/api/extractor/bootstrap?ts=${Date.now()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    },
    signal
  });

  return parseResponse<ExtractorBootstrap>(response);
}

export async function importExtractorDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/extractor/library/import", {
    body: formData,
    method: "POST"
  });

  return parseResponse<{ document: ExtractorDocumentSummary }>(response);
}

export async function getExtractorTelegraphSettings(signal?: AbortSignal) {
  const response = await fetch(`/api/extractor/telegraph/settings?ts=${Date.now()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    },
    signal
  });

  const payload = await parseResponse<{ settings: ExtractorTelegraphSettingsStatus }>(response);
  return payload.settings;
}

export async function saveExtractorTelegraphSettings(payload: {
  accessToken: string;
  authorName?: string | null;
  authorUrl?: string | null;
  shortName?: string | null;
}) {
  const response = await fetch("/api/extractor/telegraph/settings", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  const result = await parseResponse<{ settings: ExtractorTelegraphSettingsStatus }>(response);
  return result.settings;
}

export async function publishExtractorToTelegraph(
  payload: ExtractorTelegraphPublishRequest,
  files: Map<string, File>
) {
  const formData = new FormData();
  formData.append("payload", JSON.stringify(payload));

  for (const asset of payload.assets) {
    const file = files.get(asset.assetId);

    if (!file) {
      continue;
    }

    formData.append(asset.fieldName, file, asset.fileName);
  }

  const response = await fetch("/api/extractor/telegraph/publish", {
    body: formData,
    method: "POST"
  });

  const result = await parseResponse<{ result: ExtractorTelegraphPublishResult }>(response);
  return result.result;
}
