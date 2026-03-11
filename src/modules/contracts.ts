import type { ComponentType } from "react";

export type ModuleCategory = "reader";
export type ModuleStatus = "stable" | "draft";

export interface ModuleManifest {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: ModuleCategory;
  status: ModuleStatus;
  icon: string;
  accent: string;
  keywords: string[];
}

export interface PageModule {
  manifest: ModuleManifest;
  load: () => Promise<{ default: ComponentType }>;
}
