import { normalizeLemma } from "../../src/shared/reader/vocabulary";

import { ReaderHttpError } from "./reader-data";

export interface ParsedDictionaryImportRow {
  lemma: string;
  definition: string;
  partOfSpeech: string | null;
  note: string | null;
}

export interface ParsedLearnedImportRow {
  lemma: string;
  learnedAt: string | null;
  source: string | null;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function normalizeCell(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function toObjectsFromCsv(text: string) {
  const rows = parseCsvRows(text);

  if (rows.length < 2) {
    throw new ReaderHttpError("CSV import requires a header row and at least one data row.", 400);
  }

  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? "";
    });

    return record;
  });
}

function toObjectsFromJson(text: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ReaderHttpError("JSON import could not be parsed.", 400);
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    const entries = (parsed as Record<string, unknown>).entries;
    const words = (parsed as Record<string, unknown>).words;

    if (Array.isArray(entries)) {
      return entries;
    }

    if (Array.isArray(words)) {
      return words;
    }
  }

  throw new ReaderHttpError("JSON import must be an array or an object with entries/words.", 400);
}

function fileLooksLikeJson(file: File, text: string) {
  return file.name.toLowerCase().endsWith(".json") || file.type.includes("json") || text.trim().startsWith("[") || text.trim().startsWith("{");
}

function pickField(
  record: Record<string, unknown>,
  candidates: string[]
) {
  const normalizedEntries = Object.entries(record).map(([key, value]) => [
    normalizeHeader(key),
    value
  ] as const);

  for (const candidate of candidates) {
    const match = normalizedEntries.find(([key]) => key === candidate);

    if (match) {
      return normalizeCell(match[1]);
    }
  }

  return "";
}

function ensureImportRows<T>(rows: T[], kind: "dictionary" | "learned") {
  if (rows.length === 0) {
    throw new ReaderHttpError(`The ${kind} import file did not contain any usable rows.`, 400);
  }

  return rows;
}

export async function parseDictionaryImport(file: File) {
  const text = await file.text();
  const rawRecords = fileLooksLikeJson(file, text)
    ? toObjectsFromJson(text)
    : toObjectsFromCsv(text);

  const rows = rawRecords
    .map((value) => {
      if (!value || typeof value !== "object") {
        return null;
      }

      const record = value as Record<string, unknown>;
      const lemma = normalizeLemma(
        pickField(record, ["lemma", "word", "term", "headword"])
      );
      const definition = pickField(record, [
        "definition",
        "meaning",
        "translation",
        "gloss"
      ]);

      if (!lemma || !definition) {
        return null;
      }

      return {
        lemma,
        definition,
        partOfSpeech:
          pickField(record, ["partofspeech", "pos", "type"]) || null,
        note: pickField(record, ["note", "notes", "memo"]) || null
      } satisfies ParsedDictionaryImportRow;
    })
    .filter((value): value is ParsedDictionaryImportRow => value !== null);

  return {
    source: file.name || "dictionary-import",
    rows: ensureImportRows(rows, "dictionary")
  };
}

export async function parseLearnedImport(file: File) {
  const text = await file.text();
  const rawRecords = fileLooksLikeJson(file, text)
    ? toObjectsFromJson(text)
    : toObjectsFromCsv(text);

  const rows = rawRecords
    .map((value) => {
      if (!value || typeof value !== "object") {
        return null;
      }

      const record = value as Record<string, unknown>;
      const lemma = normalizeLemma(
        pickField(record, ["lemma", "word", "term", "headword"])
      );

      if (!lemma) {
        return null;
      }

      return {
        lemma,
        learnedAt: pickField(record, ["learnedat", "date", "learnedon"]) || null,
        source: pickField(record, ["source"]) || null
      } satisfies ParsedLearnedImportRow;
    })
    .filter((value): value is ParsedLearnedImportRow => value !== null);

  return {
    source: file.name || "learned-import",
    rows: ensureImportRows(rows, "learned")
  };
}
