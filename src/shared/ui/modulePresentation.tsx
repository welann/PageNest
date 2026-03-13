import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  FileSearch,
  Home,
  LibraryBig
} from "lucide-react";

import type { ModuleCategory, ModuleStatus } from "@modules/contracts";

const categoryCopy = {
  reader: {
    en: "Reading Surface",
    cn: "阅读模块",
    short: "Reading",
    icon: BookOpenText
  },
} satisfies Record<
  ModuleCategory,
  { cn: string; en: string; short: string; icon: LucideIcon }
>;

const statusCopy = {
  stable: {
    en: "Stable",
    cn: "稳定",
    variant: "success"
  },
  draft: {
    en: "Draft",
    cn: "草稿",
    variant: "outline"
  }
} as const satisfies Record<
  ModuleStatus,
  { cn: string; en: string; variant: "outline" | "success" }
>;

const moduleIconMap: Record<string, LucideIcon> = {
  home: Home,
  "ebook-reader": LibraryBig,
  "content-extractor": FileSearch
};

export function getModuleCategoryCopy(category: ModuleCategory) {
  return categoryCopy[category];
}

export function getModuleStatusCopy(status: ModuleStatus) {
  return statusCopy[status];
}

export function getModuleIcon(slug: string, category: ModuleCategory) {
  return moduleIconMap[slug] ?? categoryCopy[category].icon;
}
