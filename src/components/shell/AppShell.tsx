import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Sidebar, MobileSidebarToggle } from "@components/shell/Sidebar";
import { getModuleBySlug } from "@modules/registry";
import {
  getModuleCategoryCopy,
  getModuleStatusCopy
} from "@shared/ui/modulePresentation";

function getRouteMeta(pathname: string) {
  if (pathname === "/") {
    return {
      eyebrow: "Workspace / 工作台",
      title: "Private Reading Desk",
      description: "统一进入 Ebook Reader 与阅读数据工作流的主壳层。",
      badges: ["Cloudflare-first", "Reader Workspace", "Operator Workspace"]
    };
  }

  if (pathname.startsWith("/m/")) {
    const slug = decodeURIComponent(pathname.slice(3));
    const entry = getModuleBySlug(slug);

    if (entry) {
      const category = getModuleCategoryCopy(entry.manifest.category);
      const status = getModuleStatusCopy(entry.manifest.status);

      return {
        eyebrow: `${category.en} / ${category.cn}`,
        title: entry.manifest.title,
        description: entry.manifest.subtitle,
        badges: ["Cloudflare-first", category.short, status.en],
        statusVariant: status.variant
      };
    }
  }

  return {
    eyebrow: "Workspace / 工作台",
    title: "PageNest",
    description: "私人阅读工作台",
    badges: ["Cloudflare-first", "Workspace"]
  };
}

export function AppShell() {
  const location = useLocation();
  const routeMeta = useMemo(() => getRouteMeta(location.pathname), [location.pathname]);
  const isImmersiveRoute =
    location.pathname === "/" || location.pathname === "/m/ebook-reader";

  if (isImmersiveRoute) {
    return (
      <div className="min-h-screen px-3 py-3 sm:px-4 lg:px-5">
        <main className="mx-auto w-full max-w-[1480px]">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen xl:grid xl:grid-cols-[19.5rem_minmax(0,1fr)]">
      <Sidebar />
      <div className="min-w-0">
        <div className="mx-auto flex min-h-screen w-full max-w-[1520px] flex-col px-4 pb-10 pt-4 sm:px-6 xl:px-10">
          <header className="sticky top-0 z-20 mb-6 rounded-[1.6rem] border border-border/70 bg-background/88 px-4 py-4 shadow-[0_14px_40px_-32px_rgba(15,23,42,0.45)] backdrop-blur xl:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <MobileSidebarToggle />
                <div className="min-w-0 space-y-2">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {routeMeta.eyebrow}
                  </p>
                  <div className="space-y-1">
                    <h1 className="font-serif text-2xl tracking-[-0.03em] text-foreground sm:text-[2rem]">
                      {routeMeta.title}
                    </h1>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                      {routeMeta.description}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex flex-wrap gap-2">
                  {routeMeta.badges.map((badge, index) => (
                    <Badge
                      key={badge}
                      variant={
                        index === routeMeta.badges.length - 1 && routeMeta.statusVariant
                          ? routeMeta.statusVariant
                          : "outline"
                      }
                    >
                      {badge}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {location.pathname !== "/" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/">Back to Workspace</Link>
                    </Button>
                  ) : null}
                  <Button disabled size="sm" variant="ghost">
                    Quick Capture
                  </Button>
                  <Button disabled size="sm" variant="outline">
                    New Surface
                  </Button>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
