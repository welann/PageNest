import { moduleCatalog } from "../../src/modules/catalog";
import type { DashboardRecentModule, DashboardSnapshot } from "../../src/shared/types/api";

interface CountRow {
  count: number;
}

interface UsageRow {
  slug: string;
  summary: string;
  lastOpenedAt: string;
}

async function queryCount(db: D1Database, sql: string) {
  const row = await db.prepare(sql).first<CountRow>();
  return Number(row?.count ?? 0);
}

function createFallbackSnapshot(mode: string, hasBucket: boolean): DashboardSnapshot {
  return {
    totals: {
      modules: moduleCatalog.length,
      libraryItems: 0,
      favorites: 0,
      notes: 0
    },
    recentModules: moduleCatalog.slice(0, 3).map((moduleItem) => ({
      slug: moduleItem.slug,
      title: moduleItem.title,
      summary: "数据库尚未连接，当前展示的是静态模块骨架。",
      openedAt: new Date().toISOString()
    })),
    infrastructure: {
      d1: false,
      r2: hasBucket,
      mode
    }
  };
}

export async function buildDashboardSnapshot(env: Env): Promise<DashboardSnapshot> {
  const hasDatabase = typeof env.DB?.prepare === "function";
  const hasBucket = typeof env.LIBRARY_BUCKET?.put === "function";

  if (!hasDatabase) {
    return createFallbackSnapshot(env.APP_ENV ?? "functions preview", hasBucket);
  }

  const [libraryItems, favorites, notes, recentResult] = await Promise.all([
    queryCount(env.DB, "SELECT COUNT(*) AS count FROM reader_library_items"),
    queryCount(env.DB, "SELECT COUNT(*) AS count FROM favorites"),
    queryCount(env.DB, "SELECT COUNT(*) AS count FROM reader_notes"),
    env.DB.prepare(
      `
        SELECT slug, summary, last_opened_at AS lastOpenedAt
        FROM module_usage
        ORDER BY last_opened_at DESC
        LIMIT 5
      `
    ).all<UsageRow>()
  ]);

  const manifestLookup = new Map(
    moduleCatalog.map((moduleItem) => [moduleItem.slug, moduleItem])
  );

  const recentModules: DashboardRecentModule[] =
    recentResult.results
      ?.filter((row) => manifestLookup.has(row.slug))
      .map((row) => ({
        slug: row.slug,
        title: manifestLookup.get(row.slug)?.title ?? row.slug,
        summary: row.summary,
        openedAt: row.lastOpenedAt
      })) ?? [];

  return {
    totals: {
      modules: moduleCatalog.length,
      libraryItems,
      favorites,
      notes
    },
    recentModules,
    infrastructure: {
      d1: true,
      r2: hasBucket,
      mode: env.APP_ENV ?? "development"
    }
  };
}
