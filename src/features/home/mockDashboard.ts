import { moduleCatalog } from "@modules/catalog";
import type { DashboardSnapshot } from "@shared/types/api";

export function createMockDashboard(): DashboardSnapshot {
  return {
    totals: {
      modules: moduleCatalog.length,
      libraryItems: 12,
      favorites: 2,
      notes: 28
    },
    recentModules: [
      {
        slug: "ebook-reader",
        title: "Ebook Reader",
        summary: "继续阅读《Designing Data-Intensive Applications》",
        openedAt: new Date(Date.now() - 1000 * 60 * 22).toISOString()
      }
    ],
    infrastructure: {
      d1: false,
      r2: false,
      mode: "local fallback"
    }
  };
}
