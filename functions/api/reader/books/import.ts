import { parseEpubArchive } from "../../../_lib/reader-epub";
import {
  handleReaderError,
  insertBookRecord,
  jsonOk,
  ReaderHttpError,
  requireReaderBindings
} from "../../../_lib/reader-data";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const { db, bucket } = requireReaderBindings(env);
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      throw new ReaderHttpError("EPUB import requires a file field.", 400);
    }

    if (!fileValue.name.toLowerCase().endsWith(".epub")) {
      throw new ReaderHttpError("Only EPUB files are supported in this module.", 400);
    }

    const fileBuffer = await fileValue.arrayBuffer();
    const epubArchive = await parseEpubArchive(fileBuffer);
    const createdAt = new Date().toISOString();
    const sanitizedName = fileValue.name.replace(/[^a-zA-Z\d._-]+/g, "-");
    const storageKey = `library/${crypto.randomUUID()}-${sanitizedName}`;

    await bucket.put(storageKey, fileBuffer, {
      httpMetadata: {
        contentType: fileValue.type || "application/epub+zip"
      }
    });

    const book = await insertBookRecord(db, {
      title: epubArchive.metadata.title,
      author: epubArchive.metadata.author,
      language: epubArchive.metadata.language || "en",
      format: "epub",
      storageKey,
      createdAt
    });

    return jsonOk({ book }, 201);
  } catch (error) {
    return handleReaderError(error);
  }
};
