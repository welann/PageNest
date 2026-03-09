import { buildDashboardSnapshot } from "../_lib/dashboard";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const snapshot = await buildDashboardSnapshot(env);

  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
};

