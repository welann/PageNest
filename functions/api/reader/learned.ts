import { normalizeLemma } from "../../../src/shared/reader/vocabulary";

import {
  handleReaderError,
  jsonOk,
  markLemmasAsLearned,
  ReaderHttpError,
  requireReaderBindings
} from "../../_lib/reader-data";

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const { db } = requireReaderBindings(env);
    const body = (await request.json()) as {
      deleteUnknown?: boolean;
      itemId?: number;
      lemma?: string;
      lemmas?: string[];
      source?: string;
      learnedAt?: string;
    };
    const lemmas = Array.from(
      new Set(
        [body.lemma ?? "", ...(Array.isArray(body.lemmas) ? body.lemmas : [])]
          .map((lemma) => normalizeLemma(lemma))
          .filter(Boolean)
      )
    );

    if (!lemmas.length) {
      throw new ReaderHttpError("At least one lemma is required to mark words as learned.", 400);
    }

    const learned = await markLemmasAsLearned(
      db,
      lemmas,
      body.source?.trim() || "reader",
      body.learnedAt?.trim() || new Date().toISOString(),
      {
        deleteUnknown: body.deleteUnknown,
        itemId:
          typeof body.itemId === "number" && Number.isInteger(body.itemId) && body.itemId > 0
            ? body.itemId
            : undefined
      }
    );

    return jsonOk({ learned });
  } catch (error) {
    return handleReaderError(error);
  }
};
