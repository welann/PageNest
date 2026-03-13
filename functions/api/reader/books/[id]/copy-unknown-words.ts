import {
  getBookById,
  handleReaderError,
  jsonOk,
  listUnknownLemmas,
  ReaderHttpError,
  requireReaderBindings,
  updateClipboardExportCursor
} from "../../../../_lib/reader-data";

function parseBookId(value: string | string[]) {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const bookId = Number.parseInt(normalizedValue, 10);

  if (Number.isNaN(bookId)) {
    throw new ReaderHttpError("Book id must be a number.", 400);
  }

  return bookId;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const { db } = requireReaderBindings(env);
    const bookId = parseBookId(params.id);
    const book = await getBookById(db, bookId);

    if (!book) {
      throw new ReaderHttpError("Book not found.", 404);
    }

    const previousCursorAt = book.lastClipboardExportedAt;
    const cursorUpdatedAt = new Date().toISOString();
    const savedUnknownWords = await listUnknownLemmas(db, bookId);
    const incrementalWords = savedUnknownWords
      .filter((word) => !previousCursorAt || word.updatedAt > previousCursorAt)
      .sort(
        (left, right) =>
          left.updatedAt.localeCompare(right.updatedAt) || left.lemma.localeCompare(right.lemma)
      );
    const text = incrementalWords.map((word) => word.lemma).join("\n");

    await updateClipboardExportCursor(db, bookId, cursorUpdatedAt);

    return jsonOk({
      cursorUpdatedAt,
      exportedCount: incrementalWords.length,
      previousCursorAt,
      text
    });
  } catch (error) {
    return handleReaderError(error);
  }
};
