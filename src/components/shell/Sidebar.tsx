import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Brain,
  ChevronRight,
  Hexagon,
  Home,
  Menu
} from "lucide-react";

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

type SidebarLinkItem =
  | {
      href: string;
      icon: typeof Home;
      kind: "anchor";
      label: string;
    }
  | {
      icon: typeof Home;
      kind: "route";
      label: string;
      to: string;
    };

interface SidebarSection {
  items: SidebarLinkItem[];
  label: string;
}

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarLink({
  item,
  isActive,
  onNavigate
}: {
  isActive: boolean;
  item: SidebarLinkItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const className = cn(
    "group flex items-center justify-between gap-3 rounded-[0.65rem] border px-2.5 py-2 text-sm transition-colors outline-none",
    isActive
      ? "border-[#e5e7eb] bg-[#f4f4f5] text-[#09090b]"
      : "border-transparent text-[#18181b] hover:bg-[#f4f4f5] focus-visible:bg-[#f4f4f5]"
  );

  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="size-4 text-[#52525b]" />
        <span className="truncate">{item.label}</span>
      </div>
      <ChevronRight className="size-4 text-[#a1a1aa]" />
    </>
  );

  if (item.kind === "route") {
    return (
      <NavLink
        className={className}
        onClick={onNavigate}
        to={item.to}
      >
        {content}
      </NavLink>
    );
  }

  return (
    <a className={className} href={item.href} onClick={onNavigate}>
      {content}
    </a>
  );
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isReader = location.pathname === "/m/ebook-reader";

  const sections = useMemo<SidebarSection[]>(() => {
    if (isHome) {
      return [
        {
          label: "工坊导航",
          items: [
            {
              kind: "route",
              label: "工坊主页",
              icon: Home,
              to: "/"
            }
          ]
        }
      ];
    }

    if (isReader) {
      return [
        {
          label: "阅读工作台",
          items: [
            {
              kind: "route",
              label: "Ebook Reader",
              icon: BookOpen,
              to: "/m/ebook-reader"
            }
          ]
        },
        {
          label: "学习流程",
          items: [
            {
              kind: "anchor",
              label: "词汇复盘",
              icon: Brain,
              href: "#word-detail"
            },
            {
              kind: "anchor",
              label: "阅读统计",
              icon: BarChart3,
              href: "#reading-status"
            }
          ]
        }
      ];
    }

    return [
      {
        label: "工坊导航",
        items: [
          {
            kind: "route",
            label: "工坊主页",
            icon: Home,
            to: "/"
          }
        ]
      }
    ];
  }, [isHome, isReader]);

  const footerCopy = isReader
    ? {
        name: "Ebook Workspace",
        subtitle: "solo mode"
      }
    : {
        name: "Arc Dove",
        subtitle: "research working head"
      };

  return (
    <div className="flex h-full flex-col gap-4 bg-[#fafafa] px-2 py-2 text-[#09090b]">
      {isReader ? (
        <div className="flex items-center gap-2 rounded-md px-2 py-2">
          <div className="grid size-8 place-items-center rounded-[0.65rem] border border-[#d4d4d8] bg-[#f4f4f5]">
            <Hexagon className="size-4 text-[#18181b]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">PageNest</p>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        {sections.map((section) => (
          <div key={section.label} className="grid gap-0.5">
            <div className="px-2 py-2 text-xs font-medium text-[#737373]">{section.label}</div>
            {section.items.map((item) => {
              const isActive =
                item.kind === "route"
                  ? location.pathname === item.to
                  : location.hash === item.href;

              return (
                <SidebarLink
                  isActive={isActive}
                  item={item}
                  key={`${section.label}-${item.label}`}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="rounded-[0.7rem] border border-[#e4e4e7] bg-[#fafafa] px-2 py-2">
        <div className="flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-full border border-[#d4d4d8] bg-white text-xs font-semibold text-[#18181b]">
            PN
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{footerCopy.name}</p>
            <p className="truncate text-xs text-[#737373]">{footerCopy.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-screen border-r border-[#e4e4e7] bg-[#fafafa] xl:block xl:w-64">
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
        className="w-[min(18rem,92vw)] border-[#e4e4e7] bg-[#fafafa] p-0 text-[#09090b]"
        side="left"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Workspace Navigation</SheetTitle>
          <SheetDescription>Reader workspace entry points and page sections.</SheetDescription>
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
