import { parseLearnedImport } from "../../../_lib/reader-import";
import {
  handleReaderError,
  jsonOk,
  ReaderHttpError,
  requireReaderBindings,
  upsertLearnedEntries
} from "../../../_lib/reader-data";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const { db } = requireReaderBindings(env);
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      throw new ReaderHttpError("Learned words import requires a file field.", 400);
    }

    const imported = await parseLearnedImport(fileValue);
    const fallbackTimestamp = new Date().toISOString();

    await upsertLearnedEntries(
      db,
      imported.rows.map((row) => {
        const learnedAt = row.learnedAt || fallbackTimestamp;

        return {
          lemma: row.lemma,
          source: row.source || imported.source,
          learnedAt,
          updatedAt: learnedAt
        };
      })
    );

    return jsonOk({
      imported: imported.rows.length,
      source: imported.source
    });
  } catch (error) {
    return handleReaderError(error);
  }
};
