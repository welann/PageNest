import { buildReaderBootstrap, handleReaderError, jsonOk } from "../../_lib/reader-data";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const bootstrap = await buildReaderBootstrap(env);
    return jsonOk(bootstrap);
  } catch (error) {
    return handleReaderError(error);
  }
};
