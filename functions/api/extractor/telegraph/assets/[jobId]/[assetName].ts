import {
  ReaderHttpError,
  handleReaderError,
  requireReaderBindings
} from "../../../../../_lib/extractor-data";

function normalizePathSegment(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (!normalized) {
    throw new ReaderHttpError("Telegraph asset path is incomplete.", 400);
  }

  if (normalized.includes("/") || normalized.includes("..")) {
    throw new ReaderHttpError("Telegraph asset path is invalid.", 400);
  }

  return normalized;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const { bucket } = requireReaderBindings(env);
    const jobId = normalizePathSegment(params.jobId);
    const assetName = normalizePathSegment(params.assetName);
    const storageKey = `telegraph-assets/${jobId}/${assetName}`;
    const object = await bucket.get(storageKey);

    if (!object || !object.body) {
      throw new ReaderHttpError("Telegraph asset not found.", 404);
    }

    return new Response(object.body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream"
      }
    });
  } catch (error) {
    return handleReaderError(error);
  }
};
