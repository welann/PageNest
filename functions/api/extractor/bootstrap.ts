import { buildExtractorBootstrap, handleReaderError, jsonOk } from "../../_lib/extractor-data";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const bootstrap = await buildExtractorBootstrap(env);
    return jsonOk(bootstrap);
  } catch (error) {
    return handleReaderError(error);
  }
};
