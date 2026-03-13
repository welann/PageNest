import type { ExtractorBootstrap, ExtractorDocumentSummary } from "../../src/shared/types/extractor";
import {
  handleReaderError,
  insertBookRecord,
  jsonOk,
  ReaderHttpError,
  requireReaderBindings
} from "./reader-data";

interface ExtractorBookRow {
  id: number;
  title: string;
  author: string;
  language: string;
  format: string;
  storageKey: string;
  createdAt: string;
}

export { handleReaderError, jsonOk, ReaderHttpError, requireReaderBindings, insertBookRecord };

function buildCapabilities(format: string) {
  const normalizedFormat = format.toLowerCase();

  return {
    outline: normalizedFormat === "epub" || normalizedFormat === "pdf",
    pageRanges: normalizedFormat === "pdf"
  };
}

function mapBookRow(row: ExtractorBookRow): ExtractorDocumentSummary {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    language: row.language,
    format: row.format,
    storageKey: row.storageKey,
    createdAt: row.createdAt,
    capabilities: buildCapabilities(row.format)
  };
}

export async function buildExtractorBootstrap(env: Env): Promise<ExtractorBootstrap> {
  const hasDatabase = typeof env.DB?.prepare === "function";
  const hasBucket = typeof env.LIBRARY_BUCKET?.put === "function";

  if (!hasDatabase) {
    return {
      documents: [],
      infrastructure: {
        d1: false,
        r2: hasBucket,
        mode: env.APP_ENV ?? "functions preview"
      }
    };
  }

  const result = await env.DB.prepare(
    `
      SELECT
        id,
        title,
        author,
        language,
        format,
        storage_key AS storageKey,
        created_at AS createdAt
      FROM reader_library_items
      WHERE LOWER(format) IN ('epub', 'pdf')
      ORDER BY created_at DESC, id DESC
    `
  ).all<ExtractorBookRow>();

  return {
    documents: result.results?.map(mapBookRow) ?? [],
    infrastructure: {
      d1: true,
      r2: hasBucket,
      mode: env.APP_ENV ?? "development"
    }
  };
}
