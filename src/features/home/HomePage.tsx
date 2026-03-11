import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Database,
  HardDriveUpload,
  Search,
  Sparkles,
  Wrench
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { moduleCatalog } from "@modules/catalog";
import { useHomeDashboard } from "@features/home/useHomeDashboard";
import { formatRelativeTime } from "@shared/utils/format";
import { getModuleCategoryCopy, getModuleIcon, getModuleStatusCopy } from "@shared/ui/modulePresentation";

function HomeHeader({
  snapshotLabel
}: {
  snapshotLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-[1.4rem] border border-[#e5e3de] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafd_100%)] p-5 shadow-[0_12px_32px_rgba(148,163,184,0.14)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2.5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#7b7d80]">
            Workspace / 工坊主页（当前）
          </p>
          <div className="space-y-2">
            <h1 className="font-serif text-[2.2rem] leading-[0.95] tracking-[-0.04em] text-[#1f2e40] sm:text-[3.1rem]">
              Private Reading Desk
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#6f747b] sm:text-base">
              统一进入你的 Ebook Reader 工作流，在同一工作台里完成阅读、查词、导出与进度管理。
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap gap-2">
            <Badge className="border-[#d0ddf3] bg-[#eef4ff] text-[#4f6f99]" variant="outline">
              Cloudflare-first
            </Badge>
            <Badge className="border-[#d9dde8] bg-[#f5f6f9] text-[#646d7b]" variant="outline">
              Code Catalog
            </Badge>
            <Badge className="border-[#efd7b7] bg-[#fff6ea] text-[#9a6a34]" variant="outline">
              {snapshotLabel}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#989ca3]">Quick Capture</span>
            <Button
              className="rounded-full border-[#cfe0f7] bg-[linear-gradient(180deg,#f5f9ff_0%,#eaf2ff_100%)] text-[#31517c] shadow-[0_10px_22px_rgba(142,169,208,0.2)] hover:bg-[#eef4ff]"
              disabled
              variant="outline"
            >
              New Surface
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const { dashboard, status } = useHomeDashboard();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const toolEntries = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();

    return moduleCatalog.filter((moduleItem) => {
      if (!normalized) {
        return true;
      }

      return [
        moduleItem.title,
        moduleItem.subtitle,
        moduleItem.description,
        moduleItem.category,
        ...moduleItem.keywords
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [deferredQuery]);

  const snapshotLabel = {
    ready: "Live Snapshot",
    fallback: "Local Fallback",
    loading: "Syncing"
  }[status];

  const leadRecentModule = dashboard.recentModules[0] ?? null;

  return (
    <div className="grid gap-4 lg:gap-5">
      <HomeHeader snapshotLabel={snapshotLabel} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-[1.8rem] border border-[#dce3ec] bg-[linear-gradient(140deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_40px_rgba(147,164,184,0.12)] sm:p-[1.15rem]">
          <div className="grid gap-4">
            <div className="space-y-2">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#87909a]">
                Recent Activity / 最近打开
              </p>
              <h2 className="font-serif text-[2.5rem] leading-[0.92] tracking-[-0.05em] text-[#1f2e40] sm:text-[3.7rem]">
                近期工作流
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[#727b86]">
                这些记录来自 D1；数据库不可用时会自动回退到本地示例数据。现在工作台只保留阅读器相关上下文。
              </p>
            </div>

            {leadRecentModule ? (
              <div className="flex flex-col gap-3 rounded-[1rem] border border-[#d7e4f7] bg-[#eff5ff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#34455e]">{leadRecentModule.title} 入口</p>
                  <p className="mt-1 text-sm text-[#6f7b8d]">{leadRecentModule.summary}</p>
                </div>
                <Button asChild className="rounded-full" size="sm">
                  <Link to={`/m/${leadRecentModule.slug}`}>
                    打开 {leadRecentModule.title}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : null}

            <div className="grid gap-2.5">
              {dashboard.recentModules.map((moduleItem, index) => (
                <Link
                  key={`${moduleItem.slug}-${moduleItem.openedAt}`}
                  className={`group rounded-[1.15rem] border px-4 py-4 transition-colors ${
                    index === 0
                      ? "border-[#d2e1f6] bg-[linear-gradient(180deg,#f5f8ff_0%,#ecf3ff_100%)]"
                      : "border-[#e3e1da] bg-[#f9f8f5] hover:bg-[#f3f4f6]"
                  }`}
                  to={`/m/${moduleItem.slug}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-lg font-medium tracking-[-0.02em] text-[#243244]">
                        {moduleItem.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                        {moduleItem.summary}
                      </p>
                    </div>
                    <span className="shrink-0 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8b95a4]">
                      {formatRelativeTime(moduleItem.openedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <aside className="grid gap-3">
          <section className="rounded-[1.5rem] border border-[#d9e2ef] bg-[#f3f6fb] p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-2xl border border-[#d8e2f4] bg-[linear-gradient(180deg,#f5f8fe_0%,#ebf1fd_100%)] text-[#4a6d9e]">
                <Sparkles className="size-4" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#1f2e40]">结构速览</p>
                <p className="text-xs leading-5 text-[#465466]">
                  当前项目保留工坊首页与 Ebook Reader 两个主入口，前端继续连接 D1 / R2 阅读数据与导出接口。
                </p>
                <div className="grid gap-1.5 text-xs text-[#465466]">
                  <div className="flex items-center gap-2">
                    <Database className="size-3.5" />
                    <span>D1: {dashboard.infrastructure.d1 ? "Ready" : "Pending"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDriveUpload className="size-3.5" />
                    <span>R2: {dashboard.infrastructure.r2 ? "Ready" : "Pending"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="size-3.5" />
                    <span>Mode: {dashboard.infrastructure.mode}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-[#e2e0d9] bg-[#f7f6f3] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9aa0a9]" />
              <Input
                className="h-10 rounded-[0.9rem] border-[#e2e0d9] bg-white pl-10 shadow-none"
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="搜索工具、标签、用途..."
                value={query}
              />
            </div>
          </section>

          <section className="grid gap-2">
            <div className="space-y-1">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#87909a]">
                Tool Library / 工具总览
              </p>
              <h2 className="font-serif text-[2rem] leading-[0.92] tracking-[-0.04em] text-[#1f2e40]">
                当前模块
              </h2>
            </div>

            {toolEntries.length ? (
              toolEntries.map((moduleItem) => {
                const Icon = getModuleIcon(moduleItem.slug, moduleItem.category);
                const category = getModuleCategoryCopy(moduleItem.category);
                const statusCopy = getModuleStatusCopy(moduleItem.status);

                return (
                  <Link
                    key={moduleItem.slug}
                    className="group flex items-center justify-between gap-3 rounded-[0.95rem] border border-[#e2e0d9] bg-[#f9f8f5] px-3 py-3 transition-colors hover:border-[#c7dbf6] hover:bg-[#eef5ff]"
                    to={`/m/${moduleItem.slug}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[#d6dde8] bg-white text-[#31517c]">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#243244]">
                          {moduleItem.title}
                        </p>
                        <p className="truncate text-xs text-[#7b8596]">
                          {moduleItem.subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        className="border-[#d8dee8] bg-white text-[#667085]"
                        variant="outline"
                      >
                        {category.short}
                      </Badge>
                      <Badge
                        className={
                          statusCopy.variant === "success"
                            ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-700"
                            : "border-[#d8dee8] bg-white text-[#667085]"
                        }
                        variant="outline"
                      >
                        {statusCopy.en}
                      </Badge>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-[1rem] border border-dashed border-[#d8dee8] bg-white/80 px-4 py-5 text-sm leading-6 text-[#7b8596]">
                当前关键字下没有匹配的模块入口。
              </div>
            )}
          </section>

          <section className="flex items-center justify-between gap-3 rounded-[1rem] border border-[#d8e2f4] bg-[linear-gradient(180deg,#f5f8fe_0%,#ebf1fd_100%)] px-4 py-3">
            <div className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[#7d8490]">
              <BookOpenText className="size-3.5" />
              <span>共 {toolEntries.length} 个入口</span>
            </div>
            <span className="text-[0.68rem] font-semibold text-[#4a6d9e]">
              当前只保留 Reader 工作流
            </span>
          </section>
        </aside>
      </div>
    </div>
  );
}
