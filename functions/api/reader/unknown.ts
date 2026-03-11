import { normalizeLemma } from "../../../src/shared/reader/vocabulary";

import {
  getBookById,
  handleReaderError,
  jsonOk,
  ReaderHttpError,
  requireReaderBindings,
  upsertUnknownLemma
} from "../../_lib/reader-data";

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const { db } = requireReaderBindings(env);
    const body = (await request.json()) as {
      itemId?: number;
      lemma?: string;
      surfaceForms?: string[];
      definition?: string | null;
      partOfSpeech?: string | null;
      note?: string | null;
      phonetic?: string | null;
      sampleContext?: string;
      firstLocator?: string | null;
      source?: string;
      savedAt?: string;
    };
    const itemId = Number(body.itemId);
    const lemma = normalizeLemma(body.lemma ?? "");
    const savedAt = body.savedAt?.trim() || new Date().toISOString();

    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new ReaderHttpError("A valid book id is required to save an unknown word.", 400);
    }

    if (!lemma) {
      throw new ReaderHttpError("A lemma is required to save an unknown word.", 400);
    }

    const book = await getBookById(db, itemId);

    if (!book) {
      throw new ReaderHttpError("Book not found.", 404);
    }

    const unknown = await upsertUnknownLemma(db, {
      itemId,
      lemma,
      surfaceForms: Array.isArray(body.surfaceForms)
        ? body.surfaceForms.filter((entry): entry is string => typeof entry === "string")
        : [lemma],
      definition: body.definition?.trim() || null,
      partOfSpeech: body.partOfSpeech?.trim() || null,
      note: body.note?.trim() || null,
      phonetic: body.phonetic?.trim() || null,
      sampleContext: body.sampleContext?.trim() || lemma,
      firstLocator: body.firstLocator?.trim() || null,
      source: body.source?.trim() || "reader-unknown",
      createdAt: savedAt,
      updatedAt: savedAt
    });

    return jsonOk({ unknown });
  } catch (error) {
    return handleReaderError(error);
  }
};
