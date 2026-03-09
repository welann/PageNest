export interface DashboardRecentModule {
  slug: string;
  title: string;
  summary: string;
  openedAt: string;
}

export interface DashboardSnapshot {
  totals: {
    modules: number;
    libraryItems: number;
    favorites: number;
    notes: number;
  };
  recentModules: DashboardRecentModule[];
  infrastructure: {
    d1: boolean;
    r2: boolean;
    mode: string;
  };
}

