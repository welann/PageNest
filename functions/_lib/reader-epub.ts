import {
  parseEpubArchive as parseSharedEpubArchive,
  type ParsedEpubArchive,
  type ParsedEpubMetadata,
  type ParsedEpubSection
} from "../../src/shared/extractor/epubArchive";

import { ReaderHttpError } from "./reader-data";

export type { ParsedEpubArchive, ParsedEpubMetadata, ParsedEpubSection };

export async function parseEpubArchive(
  data: ArrayBuffer | Uint8Array
): Promise<ParsedEpubArchive> {
  try {
    return await parseSharedEpubArchive(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new ReaderHttpError(error.message, 400);
    }

    throw new ReaderHttpError("EPUB archive could not be parsed.", 400);
  }
}
