import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  Hexagon,
  Home,
  LibraryBig,
  Menu
} from "lucide-react";

import { useModuleShell } from "@components/shell/moduleShell";
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
import { cn } from "@shared/utils/cn";

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarNavLink({
  icon: Icon,
  isActive,
  label,
  onNavigate,
  subtitle,
  to
}: {
  icon: typeof Home;
  isActive?: boolean;
  label: string;
  onNavigate?: () => void;
  subtitle?: string;
  to: string;
}) {
  return (
    <NavLink
      className={cn(
        "group flex items-center justify-between gap-3 rounded-[1rem] border px-3 py-3 transition-colors outline-none",
        isActive
          ? "border-[#ddd1bf] bg-[linear-gradient(180deg,#fbf7f1_0%,#f3ede2_100%)] text-[#171717] shadow-[0_14px_30px_-28px_rgba(72,52,32,0.42)]"
          : "border-transparent text-[#27272a] hover:border-[#e4ded3] hover:bg-white/78 focus-visible:border-[#e4ded3] focus-visible:bg-white/78"
      )}
      onClick={onNavigate}
      to={to}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "grid size-10 place-items-center rounded-[0.9rem] border text-[#3f3f46]",
            isActive ? "border-[#d9c7aa] bg-white" : "border-[#e4e4e7] bg-[#fafafa]"
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          {subtitle ? <p className="truncate text-xs text-[#71717a]">{subtitle}</p> : null}
        </div>
      </div>
      <ChevronRight className="size-4 text-[#a1a1aa]" />
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const location = useLocation();
  const { activeSidebarSlot } = useModuleShell();
  const isReader = location.pathname === "/m/ebook-reader";

  const moduleLinks = useMemo(
    () => [
      {
        icon: LibraryBig,
        label: "Ebook Reader",
        subtitle: isReader ? "当前模块" : "阅读与词汇工作台",
        to: "/m/ebook-reader"
      }
    ],
    [isReader]
  );

  return (
    <div className="flex min-h-full flex-col gap-5 bg-[#faf7f2] px-3 py-3 text-[#18181b]">
      <Link
        className="flex items-center gap-3 rounded-[1.15rem] border border-[#e5ddd0] bg-white/88 px-3 py-3 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.28)] transition-colors hover:bg-white"
        onClick={onNavigate}
        to="/"
      >
        <div className="grid size-12 place-items-center rounded-[1rem] border border-[#ddd8d0] bg-[#f5f4f1]">
          <Hexagon className="size-5 text-[#18181b]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[1.05rem] font-semibold tracking-[-0.02em]">PageNest</p>
          <p className="truncate text-xs text-[#71717a]">Private reading workspace</p>
        </div>
      </Link>

      <div className="grid gap-2">
        <p className="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7c7d82]">
          Home
        </p>
        <SidebarNavLink
          icon={Home}
          isActive={location.pathname === "/"}
          label="返回主页"
          onNavigate={onNavigate}
          subtitle="Workspace overview"
          to="/"
        />
      </div>

      <div className="grid gap-2">
        <p className="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7c7d82]">
          Modules
        </p>

        {moduleLinks.map((item) => (
          <div key={item.to} className="grid gap-2">
            <SidebarNavLink
              icon={item.icon}
              isActive={location.pathname === item.to}
              label={item.label}
              onNavigate={onNavigate}
              subtitle={item.subtitle}
              to={item.to}
            />

            {location.pathname === item.to && activeSidebarSlot ? (
              <div className="ml-4 rounded-[1.15rem] border border-[#e1d7c5] bg-[linear-gradient(180deg,#fffdfa_0%,#f8f4ed_100%)] p-3 shadow-[0_18px_36px_-34px_rgba(82,62,40,0.42)]">
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#e6dccd] pb-3">
                  <div>
                    <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-[#8b6b47]">
                      Module Menu
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#232329]">
                      {activeSidebarSlot.title}
                    </p>
                    {activeSidebarSlot.description ? (
                      <p className="mt-1 text-xs leading-5 text-[#71717a]">
                        {activeSidebarSlot.description}
                      </p>
                    ) : null}
                  </div>
                  <BookOpen className="size-4 text-[#8b6b47]" />
                </div>
                {activeSidebarSlot.panel}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-[1rem] border border-[#e7e0d5] bg-white/82 px-3 py-3">
        <p className="text-sm font-medium text-[#232329]">Single-rail workspace</p>
        <p className="mt-1 text-xs leading-5 text-[#71717a]">
          阅读器状态、词义与导入导出命令现在都收纳在左侧模块子菜单里。
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden self-stretch border-r border-[#ece4d6] bg-[#faf7f2] xl:block xl:w-[22rem]">
      <ScrollArea className="sticky top-0 h-screen">
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
  }, [location.hash, location.pathname]);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button className="rounded-[0.8rem]" size="icon" variant="outline">
          <Menu className="size-4" />
          <span className="sr-only">Open workspace navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-[min(22rem,92vw)] border-[#ece4d6] bg-[#faf7f2] p-0 text-[#18181b]"
        side="left"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Workspace Navigation</SheetTitle>
          <SheetDescription>Workspace home, modules, and active reader submenu.</SheetDescription>
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
