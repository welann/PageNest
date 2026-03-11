import {
  getBookById,
  handleReaderError,
  ReaderHttpError,
  requireReaderBindings
} from "../../../../_lib/reader-data";

function parseBookId(value: string | string[]) {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const bookId = Number.parseInt(normalizedValue, 10);

  if (Number.isNaN(bookId)) {
    throw new ReaderHttpError("Book id must be a number.", 400);
  }

  return bookId;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const { db, bucket } = requireReaderBindings(env);
    const bookId = parseBookId(params.id);
    const book = await getBookById(db, bookId);

    if (!book) {
      throw new ReaderHttpError("Book not found.", 404);
    }

    const object = await bucket.get(book.storageKey);

    if (!object || !object.body) {
      throw new ReaderHttpError("Book file is missing from R2.", 404);
    }

    return new Response(object.body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": object.httpMetadata?.contentType || "application/epub+zip"
      }
    });
  } catch (error) {
    return handleReaderError(error);
  }
};
