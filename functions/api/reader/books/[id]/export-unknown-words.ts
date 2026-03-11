import {
  completeExportRecord,
  createPendingExportRecord,
  getBookById,
  handleReaderError,
  listUnknownLemmas,
  ReaderHttpError,
  requireReaderBindings
} from "../../../../_lib/reader-data";

interface ExportAggregate {
  lemma: string;
  surfaceForms: string[];
  definition: string | null;
  sampleContext: string;
  firstLocator: string | null;
  updatedAt: string;
}

function parseBookId(value: string | string[]) {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const bookId = Number.parseInt(normalizedValue, 10);

  if (Number.isNaN(bookId)) {
    throw new ReaderHttpError("Book id must be a number.", 400);
  }

  return bookId;
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function buildCsv(rows: ExportAggregate[]) {
  const header = [
    "lemma",
    "surface_forms",
    "definition",
    "sample_context",
    "first_locator",
    "updated_at"
  ];

  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.lemma,
        row.surfaceForms.join(" | "),
        row.definition ?? "词典未收录",
        row.sampleContext,
        row.firstLocator ?? "",
        row.updatedAt
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  return lines.join("\n");
}

export const onRequestPost: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const { db, bucket } = requireReaderBindings(env);
    const bookId = parseBookId(params.id);
    const book = await getBookById(db, bookId);

    if (!book) {
      throw new ReaderHttpError("Book not found.", 404);
    }

    const pending = await createPendingExportRecord(db, bookId, new Date().toISOString());
    const savedUnknownWords = await listUnknownLemmas(db, bookId);
    const exportRows = savedUnknownWords
      .map((word) => ({
        lemma: word.lemma,
        surfaceForms: [...word.surfaceForms],
        definition: word.definition,
        sampleContext: word.sampleContext,
        firstLocator: word.firstLocator,
        updatedAt: word.updatedAt
      }))
      .sort((left, right) => left.lemma.localeCompare(right.lemma));
    const csv = buildCsv(exportRows);
    const exportName = `${book.title.toLowerCase().replace(/[^a-z\d]+/g, "-") || `book-${book.id}`}-unknown-words.csv`;
    const storageKey = `exports/books/${book.id}/${Date.now()}-${exportName}`;
    const completedAt = new Date().toISOString();

    await bucket.put(storageKey, csv, {
      httpMetadata: {
        contentType: "text/csv; charset=utf-8"
      }
    });

    const exportRecord = await completeExportRecord(
      db,
      pending.id,
      bookId,
      storageKey,
      completedAt
    );

    return new Response(JSON.stringify({ exportRecord }), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    return handleReaderError(error);
  }
};
