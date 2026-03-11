import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpenText,
  Database,
  HardDriveUpload,
  Layers3,
  Menu,
  Upload
} from "lucide-react";

import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@components/ui/sheet";

interface ReaderSidebarProps {
  bookFileName: string;
  currentBookTitle: string;
  currentProgressPercent: number;
  dictionaryFileName: string;
  exportDisabled: boolean;
  exportUrl: string | null;
  latestExportLabel: string;
  learnedFileName: string;
  learnedWordCount: string;
  libraryCount: number;
  pendingAction:
    | "book"
    | "dictionary"
    | "learned"
    | "export"
    | "mark-learned"
    | "mark-page-learned"
    | "save-unknown"
    | null;
  savedUnknownCount: string;
  visibleUnknownCount: number;
  onExportCsv: () => void;
  onImportBook: () => void;
  onImportDictionary: () => void;
  onImportLearned: () => void;
}

interface ReaderSidebarContentProps extends ReaderSidebarProps {
  onNavigate?: () => void;
}

function ReaderSidebarContent({
  bookFileName,
  currentBookTitle,
  currentProgressPercent,
  dictionaryFileName,
  exportDisabled,
  exportUrl,
  latestExportLabel,
  learnedFileName,
  learnedWordCount,
  libraryCount,
  pendingAction,
  savedUnknownCount,
  visibleUnknownCount,
  onExportCsv,
  onImportBook,
  onImportDictionary,
  onImportLearned,
  onNavigate
}: ReaderSidebarContentProps) {
  function runAction(action: () => void) {
    action();
    onNavigate?.();
  }

  const statItems = [
    {
      label: "Shelf",
      value: String(libraryCount)
    },
    {
      label: "Visible",
      value: String(visibleUnknownCount)
    },
    {
      label: "Learned",
      value: learnedWordCount
    },
    {
      label: "Saved",
      value: savedUnknownCount
    }
  ];

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <section className="rounded-[1.7rem] border border-[#ddd2bf] bg-[linear-gradient(180deg,#fcfaf5_0%,#f2ede3_100%)] p-4 shadow-[0_20px_40px_-34px_rgba(80,60,38,0.42)]">
        <div className="flex items-start justify-between gap-3">
          <div className="grid size-11 place-items-center rounded-[1.2rem] border border-[#d5c8b2] bg-[#1e2430] text-sm font-semibold tracking-[0.28em] text-[#f6f1e8]">
            PN
          </div>
          <Badge
            className="border-[#cfb489]/50 bg-[#b97543]/10 text-[#8d5328]"
            variant="outline"
          >
            Reader Rail
          </Badge>
        </div>

        <div className="mt-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#807461]">
            Ebook Reader / 阅读侧栏
          </p>
          <h2 className="mt-3 font-serif text-[1.85rem] leading-[1.02] tracking-[-0.04em] text-[#1f2a37]">
            {currentBookTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5f697b]">
            当前阅读进度 {currentProgressPercent.toFixed(1)}%，从这里回到工作台或处理本次阅读会话的文件动作。
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="rounded-[0.85rem] bg-[#151821] text-white hover:bg-[#252a34]">
            <Link to="/">
              <ArrowLeft className="size-4" />
              返回工作台
            </Link>
          </Button>
          <Badge className="border-[#d5c8b2] bg-white/72 text-[#5f697b]" variant="outline">
            Quiet Navigation
          </Badge>
        </div>
      </section>

      <section className="rounded-[1.45rem] border border-[#d9dee5] bg-white p-4 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7b8596]">
              Reading Snapshot
            </p>
            <p className="mt-1 text-sm text-[#5f697b]">当前阅读状态与词表概览</p>
          </div>
          <BookOpenText className="size-4 text-[#8d5328]" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[1rem] border border-[#e5e8ee] bg-[#fbfcfe] px-3 py-3"
            >
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8a94a4]">
                {item.label}
              </div>
              <div className="mt-2 text-lg font-semibold text-[#1f2a37]">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[1rem] border border-[#ece4d8] bg-[#faf7f2] px-3 py-3 text-sm text-[#5f697b]">
          <div className="flex items-center justify-between gap-3">
            <span>Latest export</span>
            <span className="font-medium text-[#2f3746]">{latestExportLabel}</span>
          </div>
        </div>
      </section>

      <section className="rounded-[1.45rem] border border-[#d9dee5] bg-white p-4 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7b8596]">
          Command Rail
        </p>
        <p className="mt-2 text-sm leading-6 text-[#5f697b]">
          导入书籍、字典与已学词，或直接导出当前书目的未学词表。
        </p>

        <div className="mt-4 grid gap-2">
          <Button
            className="justify-start rounded-[0.9rem]"
            onClick={() => {
              runAction(onImportBook);
            }}
            variant="outline"
          >
            <Upload className="size-4" />
            {pendingAction === "book" ? "导入书籍中..." : "导入书籍"}
          </Button>
          <Button
            className="justify-start rounded-[0.9rem]"
            onClick={() => {
              runAction(onImportDictionary);
            }}
            variant="outline"
          >
            <Database className="size-4" />
            {pendingAction === "dictionary" ? "导入字典中..." : "导入字典"}
          </Button>
          <Button
            className="justify-start rounded-[0.9rem]"
            onClick={() => {
              runAction(onImportLearned);
            }}
            variant="outline"
          >
            <Layers3 className="size-4" />
            {pendingAction === "learned" ? "导入中..." : "导入已学词"}
          </Button>
          <Button
            className="justify-start rounded-[0.9rem] bg-[#151821] text-white hover:bg-[#252a34]"
            disabled={exportDisabled}
            onClick={() => {
              runAction(onExportCsv);
            }}
          >
            <HardDriveUpload className="size-4" />
            {pendingAction === "export" ? "导出中..." : "导出 CSV"}
          </Button>
        </div>

        <div className="mt-4 grid gap-1 text-xs leading-5 text-[#6f7b8f]">
          <span>Book: {bookFileName || "未选择文件"}</span>
          <span>Dictionary: {dictionaryFileName || "未选择文件"}</span>
          <span>Learned: {learnedFileName || "未选择文件"}</span>
        </div>

        {exportUrl ? (
          <div className="mt-4">
            <Button asChild className="w-full rounded-[0.9rem]" variant="outline">
              <a href={exportUrl}>下载最新 CSV</a>
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function ReaderSidebar(props: ReaderSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="xl:hidden">
        <div className="flex items-center gap-2 rounded-[1rem] border border-[#d9dee5] bg-white/92 p-2 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.32)] backdrop-blur">
          <Sheet onOpenChange={setOpen} open={open}>
            <SheetTrigger asChild>
              <Button className="rounded-[0.8rem]" variant="outline">
                <Menu className="size-4" />
                阅读菜单
              </Button>
            </SheetTrigger>
            <SheetContent
              className="w-[min(21rem,92vw)] border-[#ddd2bf] bg-[#f5f1e9] p-0"
              side="left"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Reader Navigation</SheetTitle>
                <SheetDescription>Workspace return and reader file actions.</SheetDescription>
              </SheetHeader>
              <ReaderSidebarContent
                {...props}
                onNavigate={() => {
                  setOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>

          <Button asChild className="flex-1 rounded-[0.8rem]" variant="outline">
            <Link to="/">
              <ArrowLeft className="size-4" />
              返回工作台
            </Link>
          </Button>
        </div>
      </div>

      <aside className="hidden xl:sticky xl:top-3 xl:block xl:self-start">
        <div className="w-[17rem]">
          <ReaderSidebarContent {...props} />
        </div>
      </aside>
    </>
  );
}
