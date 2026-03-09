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
      },
      {
        slug: "paper-desk",
        title: "Paper Desk",
        summary: "整理今天的论文摘录与标签",
        openedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString()
      },
      {
        slug: "subtitle-workbench",
        title: "Subtitle Workbench",
        summary: "校对一个字幕片段的分句节奏",
        openedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString()
      }
    ],
    infrastructure: {
      d1: false,
      r2: false,
      mode: "local fallback"
    }
  };
}

