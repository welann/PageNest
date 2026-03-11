import { parseDictionaryImport } from "../../../_lib/reader-import";
import {
  handleReaderError,
  jsonOk,
  ReaderHttpError,
  requireReaderBindings,
  upsertDictionaryEntries
} from "../../../_lib/reader-data";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const { db } = requireReaderBindings(env);
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      throw new ReaderHttpError("Dictionary import requires a file field.", 400);
    }

    const imported = await parseDictionaryImport(fileValue);
    const timestamp = new Date().toISOString();

    await upsertDictionaryEntries(
      db,
      imported.rows.map((row) => ({
        ...row,
        source: imported.source,
        updatedAt: timestamp
      }))
    );

    return jsonOk({
      entries: imported.rows.map((row) => ({
        ...row,
        source: imported.source,
        updatedAt: timestamp
      })),
      imported: imported.rows.length,
      source: imported.source
    });
  } catch (error) {
    return handleReaderError(error);
  }
};
