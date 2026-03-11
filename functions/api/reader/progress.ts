import {
  handleReaderError,
  jsonOk,
  ReaderHttpError,
  requireReaderBindings,
  saveBookProgress
} from "../../_lib/reader-data";

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const { db } = requireReaderBindings(env);
    const body = (await request.json()) as {
      itemId?: number;
      locator?: string;
      progressPercent?: number;
    };
    const itemId = Number(body.itemId);
    const locator = body.locator?.trim() ?? "";
    const progressPercent = Number(body.progressPercent);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new ReaderHttpError("A valid itemId is required to persist reading progress.", 400);
    }

    if (!locator) {
      throw new ReaderHttpError("A valid EPUB CFI locator is required.", 400);
    }

    if (!Number.isFinite(progressPercent)) {
      throw new ReaderHttpError("progressPercent must be a number.", 400);
    }

    const progress = await saveBookProgress(db, {
      itemId,
      locator,
      progressPercent: Math.max(0, Math.min(100, Math.round(progressPercent))),
      updatedAt: new Date().toISOString()
    });

    return jsonOk({ progress });
  } catch (error) {
    return handleReaderError(error);
  }
};
