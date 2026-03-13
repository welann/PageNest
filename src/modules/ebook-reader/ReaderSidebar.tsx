import {
  BookOpenText,
  Copy,
  Database,
  Download,
  HardDriveUpload,
  Layers3,
  Sparkles,
  Upload
} from "lucide-react";

import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import type { UnknownWordAggregate } from "@shared/reader/vocabulary";

interface ReaderSidebarPanelProps {
  bookFileName: string;
  currentBookTitle: string;
  currentProgressPercent: number;
  dictionaryFileName: string;
  clipboardExportDisabled: boolean;
  clipboardExportLabel: string;
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
    | "copy-export"
    | "mark-learned"
    | "mark-page-learned"
    | "save-unknown"
    | null;
  savedUnknownCount: string;
  selectedBookSavedUnknownCount: number;
  selectedWord: UnknownWordAggregate | null;
  selectedWordIsSavedUnknown: boolean;
  sourceMode: string;
  sourceReady: boolean;
  visibleUnknownCount: number;
  onExportCsv: () => void;
  onCopyUnknownWords: () => void;
  onImportBook: () => void;
  onImportDictionary: () => void;
  onImportLearned: () => void;
  onMarkLearned: () => void;
  onSaveUnknownWord: () => void;
}

function SectionTitle({
  title,
  subtitle
}: {
  subtitle: string;
  title: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-[#8b6b47]">
        {title}
      </p>
      <p className="text-xs leading-5 text-[#6b7280]">{subtitle}</p>
    </div>
  );
}

export function ReaderSidebarPanel({
  bookFileName,
  currentBookTitle,
  currentProgressPercent,
  dictionaryFileName,
  clipboardExportDisabled,
  clipboardExportLabel,
  exportDisabled,
  exportUrl,
  latestExportLabel,
  learnedFileName,
  learnedWordCount,
  libraryCount,
  pendingAction,
  savedUnknownCount,
  selectedBookSavedUnknownCount,
  selectedWord,
  selectedWordIsSavedUnknown,
  sourceMode,
  sourceReady,
  visibleUnknownCount,
  onExportCsv,
  onCopyUnknownWords,
  onImportBook,
  onImportDictionary,
  onImportLearned,
  onMarkLearned,
  onSaveUnknownWord
}: ReaderSidebarPanelProps) {
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
    <div className="grid gap-3">
      <section className="rounded-[1rem] border border-[#e5d7c3] bg-white px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-[#8b6b47]">
              Session
            </p>
            <h3 className="mt-2 line-clamp-3 font-serif text-[1.5rem] leading-[1.02] tracking-[-0.04em] text-[#1f2937]">
              {currentBookTitle}
            </h3>
          </div>
          <Badge className="border-[#e8dac8] bg-[#faf4eb] text-[#8b6b47]" variant="outline">
            {currentProgressPercent.toFixed(1)}%
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#71717a]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#ebe2d5] bg-[#fcfaf6] px-2.5 py-1">
            <Sparkles className="size-3.5 text-[#8b6b47]" />
            {sourceReady ? "Cloudflare" : "Fallback"}
          </span>
          <span>{sourceMode}</span>
        </div>
      </section>

      <section className="rounded-[1rem] border border-[#e5d7c3] bg-white px-3 py-3">
        <SectionTitle
          subtitle="导入和导出收纳到这一组；当前页面动作保留在阅读工具条。"
          title="Commands"
        />

        <div className="mt-3 grid gap-2">
          <Button
            className="h-11 justify-start rounded-[0.95rem] bg-[#141926] text-white hover:bg-[#20283a]"
            disabled={exportDisabled}
            onClick={onExportCsv}
          >
            <HardDriveUpload className="size-4" />
            {pendingAction === "export"
              ? "导出中..."
              : exportUrl
                ? "更新导出 CSV"
                : "生成 CSV"}
          </Button>

          <Button
            className="h-10 justify-start rounded-[0.95rem] border-[#d7dceb] bg-[#f7f9fc] text-[#243244] hover:bg-[#eef3f8]"
            disabled={clipboardExportDisabled}
            onClick={onCopyUnknownWords}
            variant="outline"
          >
            <Copy className="size-4" />
            {pendingAction === "copy-export" ? "复制中..." : "复制新增单词"}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="justify-start rounded-[0.95rem] border-[#e7dfd2] bg-[#fcfaf6] hover:bg-[#f6f1e9]"
              onClick={onImportBook}
              variant="outline"
            >
              <Upload className="size-4" />
              {pendingAction === "book" ? "导入中..." : "书籍"}
            </Button>
            <Button
              className="justify-start rounded-[0.95rem] border-[#e7dfd2] bg-[#fcfaf6] hover:bg-[#f6f1e9]"
              onClick={onImportDictionary}
              variant="outline"
            >
              <Database className="size-4" />
              {pendingAction === "dictionary" ? "导入中..." : "字典"}
            </Button>
            <Button
              className="justify-start rounded-[0.95rem] border-[#e7dfd2] bg-[#fcfaf6] hover:bg-[#f6f1e9]"
              onClick={onImportLearned}
              variant="outline"
            >
              <Layers3 className="size-4" />
              {pendingAction === "learned" ? "导入中..." : "已学词"}
            </Button>
          </div>
        </div>

        <div className="mt-3 rounded-[0.9rem] border border-[#eee5d8] bg-[#faf6ef] px-3 py-3 text-xs leading-5 text-[#6b7280]">
          <div className="flex items-center justify-between gap-3">
            <span>Latest export</span>
            <span className="font-medium text-[#374151]">{latestExportLabel}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span>Clipboard cursor</span>
            <span className="font-medium text-[#374151]">{clipboardExportLabel}</span>
          </div>
          {exportUrl ? (
            <div className="mt-2 flex justify-end">
              <a
                className="inline-flex items-center gap-1 font-medium text-[#8b6b47] transition-colors hover:text-[#6f411f]"
                href={exportUrl}
              >
                <Download className="size-3.5" />
                下载最新 CSV
              </a>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1rem] border border-[#e5d7c3] bg-white px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <SectionTitle subtitle="当前阅读状态与词表概览。" title="Snapshot" />
          <BookOpenText className="mt-0.5 size-4 text-[#8b6b47]" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[0.95rem] border border-[#ece5d9] bg-[#fcfaf6] px-3 py-3"
            >
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                {item.label}
              </p>
              <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.03em] text-[#1f2937]">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-1 text-xs leading-5 text-[#6b7280]">
          <span>Book: {bookFileName || "未选择文件"}</span>
          <span>Dictionary: {dictionaryFileName || "未选择文件"}</span>
          <span>Learned: {learnedFileName || "未选择文件"}</span>
        </div>
      </section>

      <section className="rounded-[1rem] border border-[#e5d7c3] bg-white px-3 py-3">
        <SectionTitle
          subtitle="选中正文单词后，这里会同步显示释义和手动学习动作。"
          title="Word Detail"
        />

        {selectedWord ? (
          <div className="mt-3 space-y-3">
            <div>
              <h4 className="font-serif text-[1.6rem] leading-[1.02] tracking-[-0.04em] text-[#1f2937]">
                {selectedWord.lemma}
              </h4>
              <p className="mt-1 text-xs text-[#6b7280]">
                {selectedWord.phonetic ? `/${selectedWord.phonetic}/ · ` : ""}
                {selectedWord.partOfSpeech ?? "word"}
              </p>
            </div>

            <p className="text-sm leading-6 text-[#303846]">
              {selectedWord.definition ?? "词典未收录"}
            </p>

            {selectedWord.note ? (
              <div className="rounded-[0.85rem] border border-[#ebe2d5] bg-[#fcfaf6] px-3 py-2 text-xs leading-5 text-[#6b7280]">
                {selectedWord.note}
              </div>
            ) : null}

            <div className="rounded-[0.85rem] border border-[#ebe2d5] bg-[#fcfaf6] px-3 py-2 text-xs leading-5 text-[#6b7280]">
              {selectedWord.sampleContext}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                className="rounded-[0.95rem] border-[#e7dfd2] bg-[#fcfaf6] hover:bg-[#f6f1e9]"
                disabled={selectedWordIsSavedUnknown || pendingAction === "save-unknown"}
                onClick={onSaveUnknownWord}
                size="sm"
                variant="outline"
              >
                {selectedWordIsSavedUnknown
                  ? "已在未学列表"
                  : pendingAction === "save-unknown"
                    ? "保存中..."
                    : "收入未学词"}
              </Button>
              <Button
                className="rounded-[0.95rem] bg-[#141926] text-white hover:bg-[#20283a]"
                disabled={pendingAction === "mark-learned"}
                onClick={onMarkLearned}
                size="sm"
              >
                {pendingAction === "mark-learned" ? "保存中..." : "标记已学"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-[0.9rem] border border-dashed border-[#e4d8c7] bg-[#fcfaf6] px-3 py-4 text-sm leading-6 text-[#6b7280]">
            点击正文里的高亮单词后，这里会显示词义、例句以及对应操作。
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-[#6b7280]">
          <span>当前书目已保存</span>
          <span>{selectedBookSavedUnknownCount}</span>
        </div>
      </section>
    </div>
  );
}
