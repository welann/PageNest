import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { ScrollArea } from "@components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@components/ui/sheet";
import { moduleCatalog } from "@modules/catalog";
import { preloadModule } from "@modules/registry";
import {
  getModuleCategoryCopy,
  getModuleIcon,
  plannedWorkspaceTracks
} from "@shared/ui/modulePresentation";
import { cn } from "@shared/utils/cn";

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const HomeIcon = getModuleIcon("home", "reader");

  return (
    <div className="flex h-full flex-col gap-8 px-5 py-6">
      <div className="flex items-start gap-4">
        <div className="grid size-11 place-items-center rounded-2xl border border-sidebar-border bg-sidebar-accent/90 text-sm font-semibold tracking-[0.28em] text-sidebar-accent-foreground shadow-lg shadow-black/10">
          PN
        </div>
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/58">
            Private Research Desk
          </div>
          <strong className="mt-1 block font-serif text-xl tracking-tight text-sidebar-foreground">
            PageNest / 页巢
          </strong>
          <p className="mt-2 max-w-xs text-sm leading-6 text-sidebar-foreground/68">
            为阅读、研究与后续分析预留的一体化工作台。
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/58">
              Workspace Index
            </p>
            <p className="mt-1 text-sm text-sidebar-foreground/72">工作区目录与模块入口</p>
          </div>
          <Badge
            className="border-sidebar-border bg-sidebar-accent/60 text-sidebar-accent-foreground"
            variant="outline"
          >
            {moduleCatalog.length} Modules
          </Badge>
        </div>

        <nav className="grid gap-2">
          <NavLink
            className={({ isActive }) =>
              cn(
                "group rounded-[1.35rem] border px-3.5 py-3 transition-colors outline-none",
                isActive
                  ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  : "border-transparent text-sidebar-foreground/76 hover:border-sidebar-border hover:bg-sidebar-accent/45 hover:text-sidebar-foreground focus-visible:border-sidebar-border focus-visible:bg-sidebar-accent/45 focus-visible:text-sidebar-foreground"
              )
            }
            end
            onClick={onNavigate}
            to="/"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl border border-current/12 bg-black/10">
                <HomeIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">Workspace / 工作台</div>
                <div className="truncate text-xs text-current/70">入口总览与近期活动</div>
              </div>
            </div>
          </NavLink>

          {moduleCatalog.map((moduleItem) => {
            const Icon = getModuleIcon(moduleItem.slug, moduleItem.category);

            return (
              <NavLink
                key={moduleItem.slug}
                className={({ isActive }) =>
                  cn(
                    "group rounded-[1.35rem] border px-3.5 py-3 transition-colors outline-none",
                    isActive
                      ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                      : "border-transparent text-sidebar-foreground/76 hover:border-sidebar-border hover:bg-sidebar-accent/45 hover:text-sidebar-foreground focus-visible:border-sidebar-border focus-visible:bg-sidebar-accent/45 focus-visible:text-sidebar-foreground"
                  )
                }
                onClick={onNavigate}
                onMouseEnter={() => {
                  preloadModule(moduleItem.slug);
                }}
                onFocus={() => {
                  preloadModule(moduleItem.slug);
                }}
                to={`/m/${moduleItem.slug}`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-2xl border border-current/12 bg-black/10">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{moduleItem.title}</div>
                    <div className="truncate text-xs text-current/70">
                      {getModuleCategoryCopy(moduleItem.category).cn}
                    </div>
                  </div>
                </div>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto space-y-4 rounded-[1.6rem] border border-sidebar-border bg-black/10 p-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/58">
            Reserved Tracks
          </p>
          <div className="mt-3 grid gap-3">
            {plannedWorkspaceTracks.slice(0, 2).map((track) => {
              const Icon = track.icon;

              return (
                <div key={track.en} className="flex items-start gap-3">
                  <div className="grid size-8 place-items-center rounded-xl border border-sidebar-border bg-sidebar-accent/45 text-sidebar-accent-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground">
                      {track.en} / {track.cn}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-sidebar-foreground/66">
                      {track.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            className="border-sidebar-border bg-transparent text-sidebar-foreground/84"
            variant="outline"
          >
            Cloudflare-first
          </Badge>
          <Badge
            className="border-sidebar-border bg-transparent text-sidebar-foreground/84"
            variant="outline"
          >
            Lazy Modules
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden border-r border-border/70 bg-sidebar text-sidebar-foreground xl:block">
      <ScrollArea className="h-screen">
        <SidebarContent />
      </ScrollArea>
    </aside>
  );
}

export function MobileSidebarToggle() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button className="xl:hidden" size="icon" variant="outline">
          <Menu className="size-4" />
          <span className="sr-only">Open workspace navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-[min(22rem,92vw)] border-border/80 bg-sidebar p-0 text-sidebar-foreground"
        side="left"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Workspace Navigation</SheetTitle>
          <SheetDescription>Module and workspace entry points.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-full">
          <SidebarContent
            onNavigate={() => {
              setOpen(false);
            }}
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
