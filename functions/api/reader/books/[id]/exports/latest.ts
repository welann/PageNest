import {
  getBookById,
  getLatestExportRecord,
  handleReaderError,
  jsonOk,
  ReaderHttpError,
  requireReaderBindings
} from "../../../../../_lib/reader-data";

function parseBookId(value: string | string[]) {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const bookId = Number.parseInt(normalizedValue, 10);

  if (Number.isNaN(bookId)) {
    throw new ReaderHttpError("Book id must be a number.", 400);
  }

  return bookId;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  try {
    const { db, bucket } = requireReaderBindings(env);
    const bookId = parseBookId(params.id);
    const latestExport = await getLatestExportRecord(db, bookId);
    const url = new URL(request.url);

    if (!latestExport) {
      return jsonOk({ exportRecord: null });
    }

    if (url.searchParams.get("download") === "1") {
      if (!latestExport.storageKey) {
        throw new ReaderHttpError("The latest export is not complete yet.", 409);
      }

      const book = await getBookById(db, bookId);

      if (!book) {
        throw new ReaderHttpError("Book not found.", 404);
      }

      const object = await bucket.get(latestExport.storageKey);

      if (!object || !object.body) {
        throw new ReaderHttpError("Export file is missing from R2.", 404);
      }

      return new Response(object.body, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="${latestExport.fileName ?? `book-${bookId}-unknown-words.csv`}"`,
          "Content-Type": object.httpMetadata?.contentType || "text/csv; charset=utf-8"
        }
      });
    }

    return jsonOk({
      exportRecord: latestExport
    });
  } catch (error) {
    return handleReaderError(error);
  }
};
