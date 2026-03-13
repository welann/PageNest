import { Copy, Eraser, ExternalLink, FileSearch, Layers3, Settings2, TextQuote, Upload } from "lucide-react";

import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";

interface ExtractorSidebarPanelProps {
  currentDocumentTitle: string;
  modeLabel: string;
  pageCountLabel: string;
  pendingAction:
    | "analyze"
    | "copy"
    | "extract"
    | "telegraph-publish"
    | "telegraph-save"
    | "upload"
    | null;
  resultAvailable: boolean;
  resultCharCount: number;
  resultGeneratedLabel: string;
  selectionCountLabel: string;
  statusLabel: string;
  telegraphConfigured: boolean;
  telegraphPublishLabel: string;
  telegraphPublishUrl: string | null;
  warnings: string[];
  onClearResult: () => void;
  onCopyResult: () => void;
  onOpenTelegraphSettings: () => void;
  onPublishToTelegraph: () => void;
  onUpload: () => void;
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
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-[#60728c]">
        {title}
      </p>
      <p className="text-xs leading-5 text-[#6b7280]">{subtitle}</p>
    </div>
  );
}

export function ExtractorSidebarPanel({
  currentDocumentTitle,
  modeLabel,
  pageCountLabel,
  pendingAction,
  resultAvailable,
  resultCharCount,
  resultGeneratedLabel,
  selectionCountLabel,
  statusLabel,
  telegraphConfigured,
  telegraphPublishLabel,
  telegraphPublishUrl,
  warnings,
  onClearResult,
  onCopyResult,
  onOpenTelegraphSettings,
  onPublishToTelegraph,
  onUpload
}: ExtractorSidebarPanelProps) {
  return (
    <div className="grid gap-3">
      <section className="rounded-[1rem] border border-[#dbe3ef] bg-white px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-[#60728c]">
              Session
            </p>
            <h3 className="mt-2 line-clamp-3 font-serif text-[1.5rem] leading-[1.02] tracking-[-0.04em] text-[#1f2937]">
              {currentDocumentTitle}
            </h3>
          </div>
          <Badge className="border-[#d8e2f4] bg-[#eef4ff] text-[#4f6f99]" variant="outline">
            {modeLabel}
          </Badge>
        </div>

        <div className="mt-3 grid gap-1 text-xs leading-5 text-[#6b7280]">
          <span>Status: {statusLabel}</span>
          <span>{pageCountLabel}</span>
          <span>{selectionCountLabel}</span>
        </div>
      </section>

      <section className="rounded-[1rem] border border-[#dbe3ef] bg-white px-3 py-3">
        <SectionTitle
          subtitle="上传入口、复制结果和清空动作都收进左侧模块菜单。"
          title="Quick Actions"
        />

        <div className="mt-3 grid gap-2">
          <Button
            className="h-11 justify-start rounded-[0.95rem] bg-[#142033] text-white hover:bg-[#1b2941]"
            onClick={onUpload}
          >
            <Upload className="size-4" />
            {pendingAction === "upload" ? "上传中..." : "上传 EPUB / PDF"}
          </Button>

          <Button
            className="justify-start rounded-[0.95rem] border-[#d8e2f4] bg-[#f4f8ff] text-[#27466d] hover:bg-[#eaf2ff]"
            disabled={!resultAvailable}
            onClick={onCopyResult}
            variant="outline"
          >
            <Copy className="size-4" />
            {pendingAction === "copy" ? "复制中..." : "复制结果"}
          </Button>

          <Button
            className="justify-start rounded-[0.95rem] border-[#e7dfd2] bg-[#fcfaf6] hover:bg-[#f6f1e9]"
            disabled={!resultAvailable}
            onClick={onClearResult}
            variant="outline"
          >
            <Eraser className="size-4" />
            清空结果
          </Button>

          <Button
            className="justify-start rounded-[0.95rem] border-[#d8e2f4] bg-[#f4f8ff] text-[#27466d] hover:bg-[#eaf2ff]"
            onClick={onOpenTelegraphSettings}
            variant="outline"
          >
            <Settings2 className="size-4" />
            Telegraph 设置
          </Button>

          <Button
            className="justify-start rounded-[0.95rem] border-[#d8e2f4] bg-[#f4f8ff] text-[#27466d] hover:bg-[#eaf2ff]"
            disabled={!resultAvailable || !telegraphConfigured}
            onClick={onPublishToTelegraph}
            variant="outline"
          >
            <TextQuote className="size-4" />
            发布到 Telegraph
          </Button>
        </div>
      </section>

      <section className="rounded-[1rem] border border-[#dbe3ef] bg-white px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <SectionTitle subtitle="当前提取配置和输出摘要。" title="Snapshot" />
          <FileSearch className="mt-0.5 size-4 text-[#60728c]" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[0.95rem] border border-[#e4ebf6] bg-[#f8fbff] px-3 py-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8a97ab]">
              Mode
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#1f2937]">
              {modeLabel}
            </p>
          </div>
          <div className="rounded-[0.95rem] border border-[#e4ebf6] bg-[#f8fbff] px-3 py-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8a97ab]">
              Output
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#1f2937]">
              {resultAvailable ? `${resultCharCount} chars` : "Empty"}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-[0.95rem] border border-[#ecf0f7] bg-[#fbfcfe] px-3 py-3 text-xs leading-5 text-[#6b7280]">
          <div className="flex items-center gap-2">
            <Layers3 className="size-3.5 text-[#60728c]" />
            <span>{resultGeneratedLabel}</span>
          </div>
        </div>

        <div className="mt-3 rounded-[0.95rem] border border-[#ecf0f7] bg-[#fbfcfe] px-3 py-3 text-xs leading-5 text-[#6b7280]">
          <div className="flex items-center justify-between gap-3">
            <span>{telegraphConfigured ? "Telegraph 已配置" : "Telegraph 未配置"}</span>
            {telegraphPublishUrl ? (
              <a
                className="inline-flex items-center gap-1 text-[#27466d] underline underline-offset-4"
                href={telegraphPublishUrl}
                rel="noreferrer"
                target="_blank"
              >
                打开
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
          <p className="mt-2">{telegraphPublishLabel}</p>
        </div>
      </section>

      {warnings.length ? (
        <section className="rounded-[1rem] border border-[#e8d7c6] bg-[#fdf6ef] px-3 py-3">
          <SectionTitle subtitle="非阻塞提示会在这里收拢显示。" title="Warnings" />
          <div className="mt-3 grid gap-2 text-xs leading-5 text-[#76543d]">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
