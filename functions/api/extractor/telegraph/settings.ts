import {
  handleReaderError,
  jsonOk,
  requireReaderBindings
} from "../../../_lib/extractor-data";
import { saveTelegraphSettings, getTelegraphSettingsStatus } from "../../../_lib/extractor-telegraph";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const { db } = requireReaderBindings(env);
    return jsonOk({
      settings: await getTelegraphSettingsStatus(db)
    });
  } catch (error) {
    return handleReaderError(error);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const { db } = requireReaderBindings(env);
    const payload = (await request.json()) as {
      accessToken?: string;
      authorName?: string | null;
      authorUrl?: string | null;
      shortName?: string | null;
    };

    return jsonOk({
      settings: await saveTelegraphSettings(db, {
        accessToken: payload.accessToken ?? "",
        authorName: payload.authorName ?? null,
        authorUrl: payload.authorUrl ?? null,
        shortName: payload.shortName ?? null
      })
    });
  } catch (error) {
    return handleReaderError(error);
  }
};
