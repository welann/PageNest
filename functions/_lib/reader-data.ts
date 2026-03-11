import type {
  ReaderBookProgress,
  ReaderBookSummary,
  ReaderBootstrap,
  ReaderDictionaryEntry,
  ReaderExportSummary,
  ReaderLearnedLemma,
  ReaderUnknownLemma
} from "../../src/shared/types/reader";

interface BookRow {
  id: number;
  title: string;
  author: string;
  language: string;
  format: string;
  storageKey: string;
  coverStorageKey: string | null;
  createdAt: string;
  lastExportedAt: string | null;
  locator: string | null;
  progressPercent: number | null;
  progressUpdatedAt: string | null;
}

interface DictionaryRow {
  lemma: string;
  definition: string;
  partOfSpeech: string | null;
  note: string | null;
  source: string;
  updatedAt: string;
}

interface LearnedRow {
  lemma: string;
  source: string;
  learnedAt: string;
  updatedAt: string;
}

interface ExportRow {
  id: number;
  itemId: number;
  status: "pending" | "complete";
  storageKey: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface UnknownRow {
  itemId: number;
  lemma: string;
  surfaceFormsJson: string;
  definition: string | null;
  partOfSpeech: string | null;
  note: string | null;
  phonetic: string | null;
  sampleContext: string;
  firstLocator: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export class ReaderHttpError extends Error {
  constructor(
    message: string,
    readonly status = 500
  ) {
    super(message);
  }
}

function buildJsonHeaders() {
  return {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  };
}

export function jsonOk(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildJsonHeaders()
  });
}

export function jsonError(message: string, status = 500) {
  return jsonOk({ error: message }, status);
}

export function handleReaderError(error: unknown) {
  if (error instanceof ReaderHttpError) {
    return jsonError(error.message, error.status);
  }

  return jsonError("Reader module request failed.", 500);
}

export function requireReaderBindings(env: Env) {
  if (typeof env.DB?.prepare !== "function") {
    throw new ReaderHttpError("Reader module requires a configured D1 database.", 503);
  }

  if (typeof env.LIBRARY_BUCKET?.put !== "function") {
    throw new ReaderHttpError("Reader module requires a configured R2 bucket.", 503);
  }

  return {
    db: env.DB,
    bucket: env.LIBRARY_BUCKET
  };
}

function mapBookRow(row: BookRow): ReaderBookSummary {
  const progress: ReaderBookProgress | null =
    row.locator && typeof row.progressPercent === "number" && row.progressUpdatedAt
      ? {
          locator: row.locator,
          progressPercent: row.progressPercent,
          updatedAt: row.progressUpdatedAt
        }
      : null;

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    language: row.language,
    format: row.format,
    storageKey: row.storageKey,
    coverStorageKey: row.coverStorageKey,
    createdAt: row.createdAt,
    lastExportedAt: row.lastExportedAt,
    progress
  };
}

function mapDictionaryRow(row: DictionaryRow): ReaderDictionaryEntry {
  return {
    lemma: row.lemma,
    definition: row.definition,
    partOfSpeech: row.partOfSpeech,
    note: row.note,
    phonetic: null,
    exchange: null,
    source: row.source,
    updatedAt: row.updatedAt
  };
}

function mapLearnedRow(row: LearnedRow): ReaderLearnedLemma {
  return {
    lemma: row.lemma,
    source: row.source,
    learnedAt: row.learnedAt,
    updatedAt: row.updatedAt
  };
}

function parseSurfaceForms(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function mapUnknownRow(row: UnknownRow): ReaderUnknownLemma {
  return {
    itemId: row.itemId,
    lemma: row.lemma,
    surfaceForms: parseSurfaceForms(row.surfaceFormsJson),
    definition: row.definition,
    partOfSpeech: row.partOfSpeech,
    note: row.note,
    phonetic: row.phonetic,
    sampleContext: row.sampleContext,
    firstLocator: row.firstLocator,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function buildExportDownloadUrl(itemId: number) {
  return `/api/reader/books/${itemId}/exports/latest?download=1`;
}

function mapExportRow(row: ExportRow): ReaderExportSummary {
  return {
    id: row.id,
    itemId: row.itemId,
    status: row.status,
    storageKey: row.storageKey,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    downloadUrl: row.status === "complete" && row.storageKey ? buildExportDownloadUrl(row.itemId) : null,
    fileName:
      row.status === "complete" && row.storageKey ? row.storageKey.split("/").at(-1) ?? null : null
  };
}

async function batchRun(db: D1Database, statements: D1PreparedStatement[], chunkSize = 50) {
  for (let index = 0; index < statements.length; index += chunkSize) {
    await db.batch(statements.slice(index, index + chunkSize));
  }
}

export async function buildReaderBootstrap(env: Env): Promise<ReaderBootstrap> {
  const { db } = requireReaderBindings(env);

  const [booksResult, dictionaryResult, learnedResult, unknownResult, exportsResult] =
    await Promise.all([
    db.prepare(
      `
        SELECT
          items.id,
          items.title,
          items.author,
          items.language,
          items.format,
          items.storage_key AS storageKey,
          items.cover_storage_key AS coverStorageKey,
          items.created_at AS createdAt,
          items.last_exported_at AS lastExportedAt,
          progress.locator AS locator,
          progress.progress_percent AS progressPercent,
          progress.updated_at AS progressUpdatedAt
        FROM reader_library_items AS items
        LEFT JOIN reader_progress AS progress ON progress.item_id = items.id
        ORDER BY COALESCE(progress.updated_at, items.created_at) DESC, items.id DESC
      `
    ).all<BookRow>(),
    db.prepare(
      `
        SELECT
          lemma,
          definition,
          part_of_speech AS partOfSpeech,
          note,
          source,
          updated_at AS updatedAt
        FROM reader_dictionary_entries
        ORDER BY lemma ASC
      `
    ).all<DictionaryRow>(),
    db.prepare(
      `
        SELECT
          lemma,
          source,
          learned_at AS learnedAt,
          updated_at AS updatedAt
        FROM reader_learned_lemmas
        ORDER BY updated_at DESC, lemma ASC
      `
    ).all<LearnedRow>(),
    db.prepare(
      `
        SELECT
          item_id AS itemId,
          lemma,
          surface_forms_json AS surfaceFormsJson,
          definition,
          part_of_speech AS partOfSpeech,
          note,
          phonetic,
          sample_context AS sampleContext,
          first_locator AS firstLocator,
          source,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM reader_unknown_lemmas
        ORDER BY updated_at DESC, item_id ASC, lemma ASC
      `
    ).all<UnknownRow>(),
    db.prepare(
      `
        SELECT
          exports.id,
          exports.item_id AS itemId,
          exports.status,
          exports.storage_key AS storageKey,
          exports.created_at AS createdAt,
          exports.completed_at AS completedAt
        FROM reader_exports AS exports
        WHERE exports.id IN (
          SELECT latest.id
          FROM reader_exports AS latest
          WHERE latest.item_id = exports.item_id
          ORDER BY latest.created_at DESC, latest.id DESC
          LIMIT 1
        )
        ORDER BY exports.created_at DESC, exports.id DESC
      `
    ).all<ExportRow>()
    ]);

  return {
    books: booksResult.results?.map(mapBookRow) ?? [],
    dictionary: dictionaryResult.results?.map(mapDictionaryRow) ?? [],
    learnedLemmas: learnedResult.results?.map(mapLearnedRow) ?? [],
    savedUnknownLemmas: unknownResult.results?.map(mapUnknownRow) ?? [],
    latestExports: exportsResult.results?.map(mapExportRow) ?? [],
    infrastructure: {
      d1: true,
      r2: true,
      mode: env.APP_ENV ?? "development"
    }
  };
}

export async function getBookById(db: D1Database, bookId: number) {
  const row = await db
    .prepare(
      `
        SELECT
          items.id,
          items.title,
          items.author,
          items.language,
          items.format,
          items.storage_key AS storageKey,
          items.cover_storage_key AS coverStorageKey,
          items.created_at AS createdAt,
          items.last_exported_at AS lastExportedAt,
          progress.locator AS locator,
          progress.progress_percent AS progressPercent,
          progress.updated_at AS progressUpdatedAt
        FROM reader_library_items AS items
        LEFT JOIN reader_progress AS progress ON progress.item_id = items.id
        WHERE items.id = ?
        LIMIT 1
      `
    )
    .bind(bookId)
    .first<BookRow>();

  return row ? mapBookRow(row) : null;
}

export async function insertBookRecord(
  db: D1Database,
  book: {
    title: string;
    author: string;
    language: string;
    format: string;
    storageKey: string;
    coverStorageKey?: string | null;
    createdAt: string;
  }
) {
  await db
    .prepare(
      `
        INSERT INTO reader_library_items (
          title,
          author,
          language,
          format,
          storage_key,
          cover_storage_key,
          last_exported_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
      `
    )
    .bind(
      book.title,
      book.author,
      book.language,
      book.format,
      book.storageKey,
      book.coverStorageKey ?? null,
      book.createdAt
    )
    .run();

  const inserted = await db
    .prepare(
      `
        SELECT
          items.id,
          items.title,
          items.author,
          items.language,
          items.format,
          items.storage_key AS storageKey,
          items.cover_storage_key AS coverStorageKey,
          items.created_at AS createdAt,
          items.last_exported_at AS lastExportedAt,
          progress.locator AS locator,
          progress.progress_percent AS progressPercent,
          progress.updated_at AS progressUpdatedAt
        FROM reader_library_items AS items
        LEFT JOIN reader_progress AS progress ON progress.item_id = items.id
        WHERE items.storage_key = ?
        ORDER BY items.id DESC
        LIMIT 1
      `
    )
    .bind(book.storageKey)
    .first<BookRow>();

  if (!inserted) {
    throw new ReaderHttpError("Imported book could not be persisted.", 500);
  }

  return mapBookRow(inserted);
}

export async function listDictionaryEntries(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT
          lemma,
          definition,
          part_of_speech AS partOfSpeech,
          note,
          source,
          updated_at AS updatedAt
        FROM reader_dictionary_entries
        ORDER BY lemma ASC
      `
    )
    .all<DictionaryRow>();

  return result.results?.map(mapDictionaryRow) ?? [];
}

export async function listLearnedLemmas(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT
          lemma,
          source,
          learned_at AS learnedAt,
          updated_at AS updatedAt
        FROM reader_learned_lemmas
        ORDER BY updated_at DESC, lemma ASC
      `
    )
    .all<LearnedRow>();

  return result.results?.map(mapLearnedRow) ?? [];
}

export async function listUnknownLemmas(db: D1Database, itemId?: number) {
  const statement =
    typeof itemId === "number"
      ? db
          .prepare(
            `
              SELECT
                item_id AS itemId,
                lemma,
                surface_forms_json AS surfaceFormsJson,
                definition,
                part_of_speech AS partOfSpeech,
                note,
                phonetic,
                sample_context AS sampleContext,
                first_locator AS firstLocator,
                source,
                created_at AS createdAt,
                updated_at AS updatedAt
              FROM reader_unknown_lemmas
              WHERE item_id = ?
              ORDER BY updated_at DESC, lemma ASC
            `
          )
          .bind(itemId)
      : db.prepare(
          `
            SELECT
              item_id AS itemId,
              lemma,
              surface_forms_json AS surfaceFormsJson,
              definition,
              part_of_speech AS partOfSpeech,
              note,
              phonetic,
              sample_context AS sampleContext,
              first_locator AS firstLocator,
              source,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM reader_unknown_lemmas
            ORDER BY updated_at DESC, item_id ASC, lemma ASC
          `
        );
  const result = await statement.all<UnknownRow>();

  return result.results?.map(mapUnknownRow) ?? [];
}

async function deleteUnknownLemmas(db: D1Database, lemmas: string[]) {
  if (!lemmas.length) {
    return;
  }

  await batchRun(
    db,
    lemmas.map((lemma) =>
      db
        .prepare(
          `
            DELETE FROM reader_unknown_lemmas
            WHERE lemma = ?
          `
        )
        .bind(lemma)
    )
  );
}

export async function upsertDictionaryEntries(
  db: D1Database,
  entries: Array<{
    lemma: string;
    definition: string;
    partOfSpeech: string | null;
    note: string | null;
    source: string;
    updatedAt: string;
  }>
) {
  await batchRun(
    db,
    entries.map((entry) =>
      db
        .prepare(
          `
            INSERT INTO reader_dictionary_entries (
              lemma,
              definition,
              part_of_speech,
              note,
              source,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(lemma) DO UPDATE SET
              definition = excluded.definition,
              part_of_speech = excluded.part_of_speech,
              note = excluded.note,
              source = excluded.source,
              updated_at = excluded.updated_at
          `
        )
        .bind(
          entry.lemma,
          entry.definition,
          entry.partOfSpeech,
          entry.note,
          entry.source,
          entry.updatedAt
        )
    )
  );
}

export async function upsertLearnedEntries(
  db: D1Database,
  entries: Array<{
    lemma: string;
    source: string;
    learnedAt: string;
    updatedAt: string;
  }>
) {
  await batchRun(
    db,
    entries.map((entry) =>
      db
        .prepare(
          `
            INSERT INTO reader_learned_lemmas (
              lemma,
              source,
              learned_at,
              updated_at
            )
            VALUES (?, ?, ?, ?)
            ON CONFLICT(lemma) DO UPDATE SET
              source = excluded.source,
              learned_at = excluded.learned_at,
              updated_at = excluded.updated_at
          `
        )
        .bind(entry.lemma, entry.source, entry.learnedAt, entry.updatedAt)
    )
  );

  await deleteUnknownLemmas(
    db,
    Array.from(new Set(entries.map((entry) => entry.lemma)))
  );
}

export async function markLemmasAsLearned(
  db: D1Database,
  lemmas: string[],
  source: string,
  learnedAt: string
) {
  const normalizedLemmas = Array.from(new Set(lemmas));

  if (!normalizedLemmas.length) {
    return [];
  }

  await batchRun(
    db,
    normalizedLemmas.map((lemma) =>
      db
        .prepare(
          `
            INSERT INTO reader_learned_lemmas (
              lemma,
              source,
              learned_at,
              updated_at
            )
            VALUES (?, ?, ?, ?)
            ON CONFLICT(lemma) DO UPDATE SET
              source = excluded.source,
              learned_at = excluded.learned_at,
              updated_at = excluded.updated_at
          `
        )
        .bind(lemma, source, learnedAt, learnedAt)
    )
  );

  await deleteUnknownLemmas(db, normalizedLemmas);

  return normalizedLemmas.map(
    (lemma) =>
      ({
        lemma,
        source,
        learnedAt,
        updatedAt: learnedAt
      }) satisfies ReaderLearnedLemma
  );
}

export async function upsertUnknownLemma(
  db: D1Database,
  entry: {
    itemId: number;
    lemma: string;
    surfaceForms: string[];
    definition: string | null;
    partOfSpeech: string | null;
    note: string | null;
    phonetic: string | null;
    sampleContext: string;
    firstLocator: string | null;
    source: string;
    createdAt: string;
    updatedAt: string;
  }
) {
  const surfaceFormsJson = JSON.stringify(Array.from(new Set(entry.surfaceForms)));

  await db
    .prepare(
      `
        INSERT INTO reader_unknown_lemmas (
          item_id,
          lemma,
          surface_forms_json,
          definition,
          part_of_speech,
          note,
          phonetic,
          sample_context,
          first_locator,
          source,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(item_id, lemma) DO UPDATE SET
          surface_forms_json = excluded.surface_forms_json,
          definition = excluded.definition,
          part_of_speech = excluded.part_of_speech,
          note = excluded.note,
          phonetic = excluded.phonetic,
          sample_context = excluded.sample_context,
          first_locator = excluded.first_locator,
          source = excluded.source,
          updated_at = excluded.updated_at
      `
    )
    .bind(
      entry.itemId,
      entry.lemma,
      surfaceFormsJson,
      entry.definition,
      entry.partOfSpeech,
      entry.note,
      entry.phonetic,
      entry.sampleContext,
      entry.firstLocator,
      entry.source,
      entry.createdAt,
      entry.updatedAt
    )
    .run();

  const row = await db
    .prepare(
      `
        SELECT
          item_id AS itemId,
          lemma,
          surface_forms_json AS surfaceFormsJson,
          definition,
          part_of_speech AS partOfSpeech,
          note,
          phonetic,
          sample_context AS sampleContext,
          first_locator AS firstLocator,
          source,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM reader_unknown_lemmas
        WHERE item_id = ? AND lemma = ?
        LIMIT 1
      `
    )
    .bind(entry.itemId, entry.lemma)
    .first<UnknownRow>();

  if (!row) {
    throw new ReaderHttpError("Saved unknown word could not be loaded.", 500);
  }

  return mapUnknownRow(row);
}

export async function saveBookProgress(
  db: D1Database,
  progress: {
    itemId: number;
    locator: string;
    progressPercent: number;
    updatedAt: string;
  }
) {
  await db
    .prepare(
      `
        INSERT INTO reader_progress (
          item_id,
          locator,
          progress_percent,
          updated_at
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(item_id) DO UPDATE SET
          locator = excluded.locator,
          progress_percent = excluded.progress_percent,
          updated_at = excluded.updated_at
      `
    )
    .bind(progress.itemId, progress.locator, progress.progressPercent, progress.updatedAt)
    .run();

  return {
    locator: progress.locator,
    progressPercent: progress.progressPercent,
    updatedAt: progress.updatedAt
  } satisfies ReaderBookProgress;
}

export async function createPendingExportRecord(
  db: D1Database,
  itemId: number,
  createdAt: string
) {
  await db
    .prepare(
      `
        INSERT INTO reader_exports (
          item_id,
          storage_key,
          status,
          created_at,
          completed_at
        )
        VALUES (?, NULL, 'pending', ?, NULL)
      `
    )
    .bind(itemId, createdAt)
    .run();

  const row = await db
    .prepare(
      `
        SELECT
          id,
          item_id AS itemId,
          status,
          storage_key AS storageKey,
          created_at AS createdAt,
          completed_at AS completedAt
        FROM reader_exports
        WHERE item_id = ? AND created_at = ?
        ORDER BY id DESC
        LIMIT 1
      `
    )
    .bind(itemId, createdAt)
    .first<ExportRow>();

  if (!row) {
    throw new ReaderHttpError("Failed to create export record.", 500);
  }

  return mapExportRow(row);
}

export async function completeExportRecord(
  db: D1Database,
  exportId: number,
  itemId: number,
  storageKey: string,
  completedAt: string
) {
  await db
    .prepare(
      `
        UPDATE reader_exports
        SET
          storage_key = ?,
          status = 'complete',
          completed_at = ?
        WHERE id = ?
      `
    )
    .bind(storageKey, completedAt, exportId)
    .run();

  await db
    .prepare(
      `
        UPDATE reader_library_items
        SET last_exported_at = ?
        WHERE id = ?
      `
    )
    .bind(completedAt, itemId)
    .run();

  const row = await db
    .prepare(
      `
        SELECT
          id,
          item_id AS itemId,
          status,
          storage_key AS storageKey,
          created_at AS createdAt,
          completed_at AS completedAt
        FROM reader_exports
        WHERE id = ?
        LIMIT 1
      `
    )
    .bind(exportId)
    .first<ExportRow>();

  if (!row) {
    throw new ReaderHttpError("Completed export record could not be loaded.", 500);
  }

  return mapExportRow(row);
}

export async function getLatestExportRecord(db: D1Database, itemId: number) {
  const row = await db
    .prepare(
      `
        SELECT
          id,
          item_id AS itemId,
          status,
          storage_key AS storageKey,
          created_at AS createdAt,
          completed_at AS completedAt
        FROM reader_exports
        WHERE item_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `
    )
    .bind(itemId)
    .first<ExportRow>();

  return row ? mapExportRow(row) : null;
}
