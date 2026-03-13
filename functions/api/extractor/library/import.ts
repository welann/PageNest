import { parseEpubArchive } from "../../../_lib/reader-epub";
import {
  handleReaderError,
  insertBookRecord,
  jsonOk,
  ReaderHttpError,
  requireReaderBindings
} from "../../../_lib/extractor-data";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z\d._-]+/g, "-");
}

function inferPdfTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled PDF";
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const { db, bucket } = requireReaderBindings(env);
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      throw new ReaderHttpError("Document import requires a file field.", 400);
    }

    const lowerName = fileValue.name.toLowerCase();
    const format = lowerName.endsWith(".epub")
      ? "epub"
      : lowerName.endsWith(".pdf")
        ? "pdf"
        : null;

    if (!format) {
      throw new ReaderHttpError("Only EPUB and PDF files are supported.", 400);
    }

    const fileBuffer = await fileValue.arrayBuffer();
    const createdAt = new Date().toISOString();
    const sanitizedName = sanitizeFileName(fileValue.name);
    const storageKey = `library/${crypto.randomUUID()}-${sanitizedName}`;

    let title = inferPdfTitle(fileValue.name);
    let author = "Unknown author";
    let language = "und";

    if (format === "epub") {
      const parsed = await parseEpubArchive(fileBuffer);
      title = parsed.metadata.title;
      author = parsed.metadata.author;
      language = parsed.metadata.language || "en";
    }

    await bucket.put(storageKey, fileBuffer, {
      httpMetadata: {
        contentType:
          fileValue.type || (format === "pdf" ? "application/pdf" : "application/epub+zip")
      }
    });

    const document = await insertBookRecord(db, {
      title,
      author,
      language,
      format,
      storageKey,
      createdAt
    });

    return jsonOk(
      {
        document: {
          id: document.id,
          title: document.title,
          author: document.author,
          language: document.language,
          format: document.format,
          storageKey: document.storageKey,
          createdAt: document.createdAt,
          capabilities: {
            outline: true,
            pageRanges: document.format.toLowerCase() === "pdf"
          }
        }
      },
      201
    );
  } catch (error) {
    return handleReaderError(error);
  }
};
