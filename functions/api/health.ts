export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const hasDatabase = typeof env.DB?.prepare === "function";
  const hasBucket = typeof env.LIBRARY_BUCKET?.put === "function";

  let database = "missing";

  if (hasDatabase) {
    try {
      await env.DB.prepare("SELECT 1").first();
      database = "ok";
    } catch {
      database = "error";
    }
  }

  return Response.json({
    status: database === "ok" ? "healthy" : "degraded",
    environment: env.APP_ENV ?? "development",
    services: {
      d1: database,
      r2: hasBucket ? "configured" : "missing"
    }
  });
};

