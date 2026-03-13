import type { ExtractorTelegraphPublishRequest } from "../../../../src/shared/types/extractor";
import {
  ReaderHttpError,
  handleReaderError,
  jsonOk,
  requireReaderBindings
} from "../../../_lib/extractor-data";
import { publishToTelegraph } from "../../../_lib/extractor-telegraph";

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value);
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const { db, bucket } = requireReaderBindings(env);
    const formData = await request.formData();
    const rawPayload = formData.get("payload");

    if (typeof rawPayload !== "string") {
      throw new ReaderHttpError("Telegraph publish payload is required.", 400);
    }

    const payload = JSON.parse(rawPayload) as ExtractorTelegraphPublishRequest;
    const filesByAssetId = new Map<string, File>();

    for (const asset of payload.assets) {
      const entry = formData.get(asset.fieldName);

      if (isFileEntry(entry)) {
        filesByAssetId.set(asset.assetId, entry);
      }
    }

    const result = await publishToTelegraph(
      db,
      bucket,
      new URL(request.url).origin,
      payload,
      filesByAssetId
    );

    return jsonOk({
      result
    });
  } catch (error) {
    return handleReaderError(error);
  }
};
