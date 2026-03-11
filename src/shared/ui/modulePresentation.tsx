import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Captions,
  ChartNoAxesCombined,
  FileSearch,
  Home,
  LibraryBig,
  NotebookPen,
  PanelsTopLeft,
  ScrollText
} from "lucide-react";

import type { ModuleCategory, ModuleStatus } from "@modules/contracts";

const categoryCopy = {
  reader: {
    en: "Reading Surface",
    cn: "阅读模块",
    short: "Reading",
    icon: BookOpenText
  },
  research: {
    en: "Research Surface",
    cn: "研究模块",
    short: "Research",
    icon: FileSearch
  },
  media: {
    en: "Media Surface",
    cn: "媒体模块",
    short: "Media",
    icon: Captions
  }
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
  "paper-desk": ScrollText,
  "subtitle-workbench": PanelsTopLeft
};

export const plannedWorkspaceTracks = [
  {
    en: "Data Lab",
    cn: "数据分析",
    description: "预留指标拆解、主题看板和研究快照的工作位。",
    icon: ChartNoAxesCombined
  },
  {
    en: "Investment Desk",
    cn: "投资看板",
    description: "用于组合观察、策略假设和交易前后的复盘记录。",
    icon: NotebookPen
  },
  {
    en: "Strategy Notes",
    cn: "策略思考",
    description: "承接长线判断、想法沉淀和阶段性行动清单。",
    icon: BookOpenText
  }
] as const;

export function getModuleCategoryCopy(category: ModuleCategory) {
  return categoryCopy[category];
}

export function getModuleStatusCopy(status: ModuleStatus) {
  return statusCopy[status];
}

export function getModuleIcon(slug: string, category: ModuleCategory) {
  return moduleIconMap[slug] ?? categoryCopy[category].icon;
}
