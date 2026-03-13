import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ChevronRight,
  Copy,
  ExternalLink,
  FileStack,
  Globe,
  LoaderCircle,
  Search,
  Settings2,
  Sparkles,
  SquareSplitHorizontal,
  TextQuote,
  Upload
} from "lucide-react";
import { toast } from "sonner";

import { useSetActiveSidebarSlot } from "@components/shell/moduleShell";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@components/ui/sheet";
import { EpubPreviewSurface } from "@modules/content-extractor/EpubPreviewSurface";
import { ExtractorSidebarPanel } from "@modules/content-extractor/ExtractorSidebar";
import { buildTelegraphPublishRequest } from "@modules/content-extractor/telegraphPublish";
import { analyzeEpubArchive, extractEpubByOutline, type ParsedEpubDocument } from "@shared/extractor/epubSelection";
import { normalizeEpubSectionHref, parseEpubArchive } from "@shared/extractor/epubArchive";
import { type ParsedPdfDocument, analyzePdfDocument, extractPdfByOutline, extractPdfByPageRanges } from "@shared/extractor/pdf";
import {
  collectOutlineLabels,
  formatPageRanges,
  parsePageRangeInputs,
  serializeExtractorResult
} from "@shared/extractor/selection";
import type {
  ExtractorBootstrap,
  ExtractorDocumentSummary,
  ExtractorMode,
  ExtractorOutlineNode,
  ExtractorResult,
  ExtractorResultBlock,
  ExtractorTelegraphPublishResult,
  ExtractorTelegraphSettingsStatus
} from "@shared/types/extractor";
import { formatRelativeTime } from "@shared/utils/format";
import { getReaderBookFileUrl } from "@services/api/reader";
import {
  getExtractorBootstrap,
  getExtractorTelegraphSettings,
  importExtractorDocument,
  publishExtractorToTelegraph,
  saveExtractorTelegraphSettings
} from "@services/api/extractor";

type PreparedDocument =
  | {
      kind: "epub";
      value: ParsedEpubDocument;
    }
  | {
      kind: "pdf";
      value: ParsedPdfDocument;
    };

const emptyBootstrap: ExtractorBootstrap = {
  documents: [],
  infrastructure: {
    d1: false,
    r2: false,
    mode: "loading"
  }
};

const emptyTelegraphSettings: ExtractorTelegraphSettingsStatus = {
  configured: false,
  shortName: null,
  authorName: null,
  authorUrl: null,
  updatedAt: null
};

function SectionHeading({
  eyebrow,
  title,
  description
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#8190a3]">
        {eyebrow}
      </p>
      <div className="space-y-2">
        <h2 className="font-serif text-[2rem] leading-[0.92] tracking-[-0.05em] text-[#1f2e40] sm:text-[2.5rem]">
          {title}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-[#6f747b]">{description}</p>
      </div>
    </div>
  );
}

function OutlineTree({
  nodes,
  selectedIds,
  onToggle
}: {
  nodes: ExtractorOutlineNode[];
  onToggle: (nodeId: string) => void;
  selectedIds: Set<string>;
}) {
  return (
    <div className="grid gap-2">
      {nodes.map((node) => (
        <div key={node.id} className="grid gap-2">
          <label className="flex items-start gap-3 rounded-[1rem] border border-[#e3e7ef] bg-white px-3 py-3 text-sm text-[#334155]">
            <input
              checked={selectedIds.has(node.id)}
              className="mt-0.5 size-4 rounded border-[#cbd5e1] text-[#4f6f99]"
              onChange={() => {
                onToggle(node.id);
              }}
              type="checkbox"
            />
            <span className="min-w-0">
              <span className="block font-medium">{node.label}</span>
              {node.href ? (
                <span className="mt-1 block text-xs text-[#8290a3]">{node.href}</span>
              ) : null}
            </span>
          </label>

          {node.children.length ? (
            <div className="ml-5 border-l border-[#e2e8f0] pl-3">
              <OutlineTree nodes={node.children} onToggle={onToggle} selectedIds={selectedIds} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ResultBlockView({
  block,
  imageUrl
}: {
  block: ExtractorResultBlock;
  imageUrl?: string;
}) {
  if (block.type === "section-break") {
    return (
      <div className="sticky top-0 z-10 bg-[#fffdf8]/95 py-2 backdrop-blur">
        <div className="inline-flex rounded-full border border-[#e2d8c9] bg-[#f9f2e9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6b47]">
          {block.label}
        </div>
      </div>
    );
  }

  if (block.type === "page-break") {
    return (
      <div className="py-2">
        <div className="inline-flex rounded-full border border-[#d8e2f4] bg-[#eef4ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#4f6f99]">
          第 {block.pageNumber} 页
        </div>
      </div>
    );
  }

  if (block.type === "heading") {
    const HeadingTag = block.level <= 2 ? "h3" : "h4";

    return (
      <HeadingTag className="font-serif text-[1.3rem] leading-[1.15] tracking-[-0.03em] text-[#213147]">
        {block.text}
      </HeadingTag>
    );
  }

  if (block.type === "quote") {
    return (
      <blockquote className="rounded-[1rem] border border-[#e6dccd] bg-[#fcf7f0] px-4 py-3 text-sm leading-7 text-[#5b433d]">
        {block.text}
      </blockquote>
    );
  }

  if (block.type === "list-item") {
    return <p className="text-sm leading-7 text-[#334155]">• {block.text}</p>;
  }

  if (block.type === "image") {
    if (imageUrl) {
      return (
        <figure className="grid gap-3 overflow-hidden rounded-[1.2rem] border border-[#e2d9cb] bg-[#fffaf2] p-3 sm:p-4">
          <div className="overflow-hidden rounded-[0.95rem] border border-[#eadfce] bg-white">
            <img
              alt={block.alt || block.caption || block.sourceLabel || "EPUB image"}
              className="max-h-[32rem] w-full object-contain"
              loading="lazy"
              src={imageUrl}
            />
          </div>
          {block.caption ? (
            <figcaption className="text-sm leading-6 text-[#6f5a40]">{block.caption}</figcaption>
          ) : null}
        </figure>
      );
    }

    return (
      <figure className="rounded-[1rem] border border-[#e2d9cb] bg-[#fdf8f1] px-4 py-4 text-[#6f5a40]">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-9 items-center justify-center rounded-full border border-[#e7dccb] bg-white text-[#8b6b47]">
            <Globe className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#3f3a33]">
              {block.caption || block.alt || block.sourceLabel || "Image block"}
            </p>
            <p className="mt-1 text-xs text-[#8b7b67]">
              {typeof block.pageNumber === "number"
                ? `第 ${block.pageNumber} 页图像会在发布时渲染并上传到 Telegraph。`
                : "EPUB 图片已在上方原始章节预览中展示，也会按顺序上传到 Telegraph。"}
            </p>
          </div>
        </div>
      </figure>
    );
  }

  return <p className="text-sm leading-7 text-[#334155]">{block.text}</p>;
}

function triggerFileDialog(input: HTMLInputElement | null) {
  input?.click();
}

export default function ContentExtractorView() {
  const setActiveSidebarSlot = useSetActiveSidebarSlot();
  const [bootstrap, setBootstrap] = useState<ExtractorBootstrap>(emptyBootstrap);
  const [bootstrapStatus, setBootstrapStatus] = useState<"error" | "loading" | "ready">("loading");
  const [bootstrapError, setBootstrapError] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [preparedDocument, setPreparedDocument] = useState<PreparedDocument | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<"error" | "idle" | "loading" | "ready">("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [mode, setMode] = useState<ExtractorMode>("outline");
  const [outlineSelection, setOutlineSelection] = useState<string[]>([]);
  const [pageRangeInputs, setPageRangeInputs] = useState<string[]>([""]);
  const [result, setResult] = useState<ExtractorResult | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "analyze" | "copy" | "extract" | "telegraph-publish" | "telegraph-save" | "upload" | null
  >(null);
  const [query, setQuery] = useState("");
  const [telegraphSettings, setTelegraphSettings] =
    useState<ExtractorTelegraphSettingsStatus>(emptyTelegraphSettings);
  const [telegraphSettingsError, setTelegraphSettingsError] = useState("");
  const [telegraphSettingsStatus, setTelegraphSettingsStatus] = useState<"error" | "loading" | "ready">("loading");
  const [telegraphSheetOpen, setTelegraphSheetOpen] = useState(false);
  const [telegraphForm, setTelegraphForm] = useState({
    accessToken: "",
    authorName: "",
    authorUrl: "",
    shortName: ""
  });
  const [telegraphPublishResult, setTelegraphPublishResult] =
    useState<ExtractorTelegraphPublishResult | null>(null);
  const [epubSourceBuffer, setEpubSourceBuffer] = useState<ArrayBuffer | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const analysisRequestRef = useRef(0);
  const deferredQuery = useDeferredValue(query);

  const filteredDocuments = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();

    return bootstrap.documents.filter((document) => {
      if (!normalized) {
        return true;
      }

      return [
        document.title,
        document.author,
        document.format,
        document.language
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [bootstrap.documents, deferredQuery]);

  const selectedDocument = useMemo(
    () => bootstrap.documents.find((document) => document.id === selectedDocumentId) ?? null,
    [bootstrap.documents, selectedDocumentId]
  );
  const epubDocument = preparedDocument?.kind === "epub" ? preparedDocument.value : null;
  const analysis = preparedDocument?.value.analysis ?? null;
  const selectedOutlineIds = useMemo(() => new Set(outlineSelection), [outlineSelection]);
  const pageRangeState = useMemo(
    () => parsePageRangeInputs(pageRangeInputs, analysis?.pageCount ?? null),
    [analysis?.pageCount, pageRangeInputs]
  );
  const epubPreviewSections = useMemo(() => {
    if (!epubDocument || !result?.sourceRefs?.length) {
      return [];
    }

    const sectionsByHref = new Map(
      epubDocument.archive.sections.map((section) => [normalizeEpubSectionHref(section.href), section])
    );

    return result.sourceRefs
      .map((href) => sectionsByHref.get(normalizeEpubSectionHref(href)))
      .filter((section): section is (typeof epubDocument.archive.sections)[number] => Boolean(section))
      .map((section) => ({
        href: normalizeEpubSectionHref(section.href),
        title: section.title
      }));
  }, [epubDocument, result?.sourceRefs]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBootstrap() {
      try {
        const snapshot = await getExtractorBootstrap(controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setBootstrap(snapshot);
          setBootstrapStatus("ready");
          setBootstrapError("");
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setBootstrapStatus("error");
          setBootstrapError(error instanceof Error ? error.message : "模块数据加载失败。");
        });
      }
    }

    void loadBootstrap();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTelegraphSettings() {
      try {
        const settings = await getExtractorTelegraphSettings(controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setTelegraphSettings(settings);
          setTelegraphSettingsStatus("ready");
          setTelegraphSettingsError("");
          setTelegraphForm((current) => ({
            accessToken: current.accessToken,
            authorName: settings.authorName ?? "",
            authorUrl: settings.authorUrl ?? "",
            shortName: settings.shortName ?? ""
          }));
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setTelegraphSettingsStatus("error");
          setTelegraphSettingsError(error instanceof Error ? error.message : "Telegraph 配置状态加载失败。");
        });
      }
    }

    void loadTelegraphSettings();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!bootstrap.documents.length) {
      setSelectedDocumentId(null);
      return;
    }

    if (selectedDocumentId && bootstrap.documents.some((document) => document.id === selectedDocumentId)) {
      return;
    }

    setSelectedDocumentId(bootstrap.documents[0].id);
  }, [bootstrap.documents, selectedDocumentId]);

  useEffect(() => {
    setOutlineSelection([]);
    setPageRangeInputs([""]);
    setResult(null);
    setTelegraphPublishResult(null);
    setPreparedDocument(null);
    setEpubSourceBuffer(null);
    setAnalysisStatus(selectedDocument ? "loading" : "idle");
    setAnalysisError("");
  }, [selectedDocumentId]);

  useEffect(() => {
    setTelegraphPublishResult(null);
  }, [mode, outlineSelection, pageRangeInputs]);

  useEffect(() => {
    if (result) {
      setTelegraphPublishResult(null);
    }
  }, [result?.generatedAt]);

  useEffect(() => {
    if (!selectedDocument) {
      return;
    }

    const activeDocument = selectedDocument;
    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;

    async function analyzeDocument() {
      setPendingAction("analyze");

      try {
        const response = await fetch(getReaderBookFileUrl(activeDocument.id), {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("文档文件读取失败。");
        }

        const arrayBuffer = await response.arrayBuffer();

        if (analysisRequestRef.current !== requestId) {
          return;
        }

        if (activeDocument.format.toLowerCase() === "epub") {
          const archive = await parseEpubArchive(arrayBuffer);
          const parsed = analyzeEpubArchive(archive, activeDocument.id);

          if (analysisRequestRef.current !== requestId) {
            return;
          }

          startTransition(() => {
            setPreparedDocument({
              kind: "epub",
              value: parsed
            });
            setEpubSourceBuffer(arrayBuffer);
            setMode("outline");
            setAnalysisStatus("ready");
          });
          return;
        }

        const parsed = await analyzePdfDocument(arrayBuffer, activeDocument.id);

        if (analysisRequestRef.current !== requestId) {
          await parsed.pdf.destroy();
          return;
        }

        startTransition(() => {
          setPreparedDocument({
            kind: "pdf",
            value: parsed
          });
          setEpubSourceBuffer(null);
          setMode(parsed.analysis.supportsOutline ? "outline" : "pages");
          setAnalysisStatus("ready");
        });
      } catch (error) {
        if (analysisRequestRef.current !== requestId) {
          return;
        }

        startTransition(() => {
          setPreparedDocument(null);
          setEpubSourceBuffer(null);
          setAnalysisStatus("error");
          setAnalysisError(error instanceof Error ? error.message : "文档分析失败。");
        });
      } finally {
        if (analysisRequestRef.current === requestId) {
          setPendingAction(null);
        }
      }
    }

    void analyzeDocument();
  }, [selectedDocument]);

  useEffect(() => {
    return () => {
      if (preparedDocument?.kind === "pdf") {
        void preparedDocument.value.pdf.destroy();
      }
    };
  }, [preparedDocument]);

  useEffect(() => {
    if (!analysis) {
      return;
    }

    if (analysis.format === "epub" && mode !== "outline") {
      setMode("outline");
      return;
    }

    if (analysis.format === "pdf" && mode === "outline" && !analysis.supportsOutline) {
      setMode("pages");
    }
  }, [analysis, mode]);

  const sidebarWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (analysis?.warnings.length) {
      warnings.push(...analysis.warnings);
    }

    if (result?.warnings.length) {
      warnings.push(...result.warnings);
    }

    return Array.from(new Set(warnings));
  }, [analysis?.warnings, result?.warnings]);

  useEffect(() => {
    setActiveSidebarSlot({
      moduleSlug: "content-extractor",
      title: "Extractor Menu",
      description: "上传文档、查看当前选择并复制提取结果。",
      panel: (
        <ExtractorSidebarPanel
          currentDocumentTitle={selectedDocument?.title ?? "请选择文档"}
          modeLabel={mode === "outline" ? "按目录" : "按页码"}
          pageCountLabel={
            analysis?.pageCount ? `总页数: ${analysis.pageCount}` : "总页数: EPUB 无稳定页码"
          }
          pendingAction={pendingAction}
          resultAvailable={Boolean(result?.text)}
          resultCharCount={result?.charCount ?? 0}
          resultGeneratedLabel={
            result ? `最近生成: ${formatRelativeTime(result.generatedAt)}` : "尚未生成结果"
          }
          telegraphConfigured={telegraphSettings.configured}
          telegraphPublishLabel={
            telegraphPublishResult?.indexPageUrl
              ? "最近发布: 目录页已生成"
              : telegraphPublishResult?.partPages[0]?.url
                ? "最近发布: 单页已生成"
                : "尚未发布到 Telegraph"
          }
          telegraphPublishUrl={
            telegraphPublishResult?.indexPageUrl ?? telegraphPublishResult?.partPages[0]?.url ?? null
          }
          selectionCountLabel={
            mode === "outline"
              ? `已选目录: ${outlineSelection.length}`
              : `页码区间: ${pageRangeState.ranges.length || 0}`
          }
          statusLabel={
            analysisStatus === "loading"
              ? "分析中"
              : analysisStatus === "error"
                ? "分析失败"
                : analysisStatus === "ready"
                  ? "可提取"
                  : "待选择"
          }
          warnings={sidebarWarnings}
          onClearResult={() => {
            setResult(null);
          }}
          onCopyResult={() => {
            void handleCopyResult();
          }}
          onOpenTelegraphSettings={() => {
            setTelegraphSheetOpen(true);
          }}
          onPublishToTelegraph={() => {
            void handlePublishToTelegraph();
          }}
          onUpload={() => {
            triggerFileDialog(fileInputRef.current);
          }}
        />
      )
    });

    return () => {
      setActiveSidebarSlot(null);
    };
  });

  function updateResult(nextResult: ExtractorResult) {
    const text = serializeExtractorResult(nextResult);

    setResult({
      ...nextResult,
      text,
      charCount: text.length
    });
  }

  function handleToggleOutlineNode(nodeId: string) {
    setOutlineSelection((current) =>
      current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId]
    );
  }

  function handleAddRangeRow() {
    setPageRangeInputs((current) => [...current, ""]);
  }

  function handleRangeChange(index: number, value: string) {
    setPageRangeInputs((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function handleRemoveRange(index: number) {
    setPageRangeInputs((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [""];
    });
  }

  async function handleUploadFile(file: File) {
    setPendingAction("upload");

    try {
      const imported = await importExtractorDocument(file);

      startTransition(() => {
        setBootstrap((current) => ({
          ...current,
          documents: [
            imported.document,
            ...current.documents.filter((document) => document.id !== imported.document.id)
          ]
        }));
        setSelectedDocumentId(imported.document.id);
      });
      toast.success(`${imported.document.title} 已加入共享书库。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "文档上传失败。");
    } finally {
      setPendingAction(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleExtract() {
    if (!selectedDocument || !preparedDocument) {
      return;
    }

    if (preparedDocument.kind === "epub" && !outlineSelection.length) {
      return;
    }

    if (preparedDocument.kind === "pdf" && mode === "outline" && !outlineSelection.length) {
      return;
    }

    if (preparedDocument.kind === "pdf" && mode === "pages" && !pageRangeState.ranges.length) {
      return;
    }

    if (pageRangeState.errors.length) {
      toast.error(pageRangeState.errors[0]);
      return;
    }

    setPendingAction("extract");

    try {
      let nextResult: ExtractorResult;

      if (preparedDocument.kind === "epub") {
        nextResult = extractEpubByOutline(preparedDocument.value, selectedDocument, outlineSelection);
      } else if (mode === "outline") {
        nextResult = await extractPdfByOutline(preparedDocument.value, selectedDocument, outlineSelection);
      } else {
        nextResult = await extractPdfByPageRanges(
          preparedDocument.value,
          selectedDocument,
          pageRangeState.ranges
        );
      }

      updateResult(nextResult);

      if (nextResult.warnings.length && !nextResult.blocks.length) {
        toast.warning(nextResult.warnings[0]);
      } else {
        toast.success("提取完成。");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提取失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCopyResult() {
    if (!result?.text) {
      return;
    }

    setPendingAction("copy");

    try {
      await navigator.clipboard.writeText(result.text);
      toast.success("结果已复制到剪贴板。");
    } catch {
      toast.error("复制失败，请检查浏览器权限。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTelegraphSettings() {
    setPendingAction("telegraph-save");

    try {
      const nextSettings = await saveExtractorTelegraphSettings({
        accessToken: telegraphForm.accessToken,
        authorName: telegraphForm.authorName || null,
        authorUrl: telegraphForm.authorUrl || null,
        shortName: telegraphForm.shortName || null
      });

      startTransition(() => {
        setTelegraphSettings(nextSettings);
        setTelegraphSettingsStatus("ready");
        setTelegraphSettingsError("");
        setTelegraphSheetOpen(false);
        setTelegraphForm((current) => ({
          ...current,
          accessToken: "",
          authorName: nextSettings.authorName ?? "",
          authorUrl: nextSettings.authorUrl ?? "",
          shortName: nextSettings.shortName ?? ""
        }));
      });
      toast.success("Telegraph 配置已保存。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Telegraph 配置保存失败。";

      setTelegraphSettingsStatus("error");
      setTelegraphSettingsError(message);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePublishToTelegraph() {
    if (!result || !preparedDocument) {
      return;
    }

    setPendingAction("telegraph-publish");

    try {
      const { payload, files } = await buildTelegraphPublishRequest(result, preparedDocument);
      const published = await publishExtractorToTelegraph(payload, files);

      startTransition(() => {
        setTelegraphPublishResult(published);
      });

      toast.success(published.indexPageUrl ? "已生成 Telegraph 目录页。" : "已发布到 Telegraph。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Telegraph 发布失败。");
    } finally {
      setPendingAction(null);
    }
  }

  const outlineLabels = useMemo(
    () => (analysis ? collectOutlineLabels(analysis.outline, selectedOutlineIds) : []),
    [analysis, selectedOutlineIds]
  );
  const extractDisabled =
    !selectedDocument ||
    !preparedDocument ||
    pendingAction === "extract" ||
    analysisStatus !== "ready" ||
    (mode === "outline" && !outlineSelection.length) ||
    (mode === "pages" && (!pageRangeState.ranges.length || pageRangeState.errors.length > 0));
  const telegraphPublishDisabled =
    !result ||
    !preparedDocument ||
    pendingAction === "telegraph-publish" ||
    !telegraphSettings.configured;

  return (
    <div className="grid gap-5">
      <input
        accept=".epub,.pdf,application/epub+zip,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void handleUploadFile(file);
          }
        }}
        ref={fileInputRef}
        type="file"
      />

      <Sheet onOpenChange={setTelegraphSheetOpen} open={telegraphSheetOpen}>
        <SheetContent className="overflow-y-auto border-[#dce3ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] sm:max-w-[28rem]">
          <SheetHeader>
            <SheetTitle>Telegraph 设置</SheetTitle>
            <SheetDescription>
              保存工作区级 Telegraph 账号信息。首次配置或轮换 token 时输入 access token；仅更新作者信息时可以留空。
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4">
            <div className="rounded-[1rem] border border-[#dbe4ef] bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#1f2e40]">当前状态</p>
                  <p className="mt-1 text-xs leading-5 text-[#6f7b8d]">
                    {telegraphSettings.configured ? "已配置，可直接发布。" : "未配置，需要先保存 Telegraph token。"}
                  </p>
                </div>
                <Badge
                  className={telegraphSettings.configured ? "border-[#d8e2f4] bg-[#eef4ff] text-[#4f6f99]" : "border-[#e8d7c6] bg-[#fdf6ef] text-[#8b6b47]"}
                  variant="outline"
                >
                  {telegraphSettings.configured ? "Configured" : "Not Ready"}
                </Badge>
              </div>

              {telegraphSettings.updatedAt ? (
                <p className="mt-3 text-xs text-[#6f7b8d]">
                  最近更新: {formatRelativeTime(telegraphSettings.updatedAt)}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-[#1f2e40]" htmlFor="telegraph-access-token">
                Access Token
              </label>
              <Input
                className="rounded-[1rem] border-[#dbe4ef] bg-white"
                id="telegraph-access-token"
                onChange={(event) => {
                  setTelegraphForm((current) => ({
                    ...current,
                    accessToken: event.target.value
                  }));
                }}
                placeholder={telegraphSettings.configured ? "留空则沿用当前 token" : "例如 123456:abcdef..."}
                type="password"
                value={telegraphForm.accessToken}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-[#1f2e40]" htmlFor="telegraph-short-name">
                Short Name
              </label>
              <Input
                className="rounded-[1rem] border-[#dbe4ef] bg-white"
                id="telegraph-short-name"
                onChange={(event) => {
                  setTelegraphForm((current) => ({
                    ...current,
                    shortName: event.target.value
                  }));
                }}
                placeholder="workspace-short-name"
                value={telegraphForm.shortName}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-[#1f2e40]" htmlFor="telegraph-author-name">
                Author Name
              </label>
              <Input
                className="rounded-[1rem] border-[#dbe4ef] bg-white"
                id="telegraph-author-name"
                onChange={(event) => {
                  setTelegraphForm((current) => ({
                    ...current,
                    authorName: event.target.value
                  }));
                }}
                placeholder="PageNest"
                value={telegraphForm.authorName}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-[#1f2e40]" htmlFor="telegraph-author-url">
                Author URL
              </label>
              <Input
                className="rounded-[1rem] border-[#dbe4ef] bg-white"
                id="telegraph-author-url"
                onChange={(event) => {
                  setTelegraphForm((current) => ({
                    ...current,
                    authorUrl: event.target.value
                  }));
                }}
                placeholder="https://..."
                value={telegraphForm.authorUrl}
              />
            </div>

            {(telegraphSettingsStatus === "error" || telegraphSettingsError) ? (
              <div className="rounded-[1rem] border border-[#e8d7c6] bg-[#fdf6ef] px-4 py-3 text-sm text-[#76543d]">
                {telegraphSettingsError || "Telegraph 配置不可用。"}
              </div>
            ) : null}
          </div>

          <SheetFooter>
            <Button
              className="h-11 rounded-[1rem] bg-[#162236] text-white hover:bg-[#1c2b44]"
              disabled={pendingAction === "telegraph-save" || (!telegraphSettings.configured && !telegraphForm.accessToken.trim())}
              onClick={() => {
                void handleSaveTelegraphSettings();
              }}
            >
              {pendingAction === "telegraph-save" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Settings2 className="size-4" />
              )}
              {pendingAction === "telegraph-save" ? "保存中..." : "保存 Telegraph 配置"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <section className="overflow-hidden rounded-[1.6rem] border border-[#dce3ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-5 shadow-[0_18px_40px_rgba(147,164,184,0.12)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#7b7d80]">
              Reading Surface / 内容提取工作台
            </p>
            <div className="space-y-2">
              <h1 className="font-serif text-[2.4rem] leading-[0.94] tracking-[-0.05em] text-[#1f2e40] sm:text-[3.2rem]">
                Outline to Text Desk
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[#6f747b] sm:text-base">
                从共享书库中选文档，按目录或页码提取需要的正文片段。EPUB 走目录模式，PDF 支持书签目录和多区间页码。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="border-[#d8e2f4] bg-[#eef4ff] text-[#4f6f99]" variant="outline">
              Shared Library
            </Badge>
            <Badge className="border-[#e2e0d9] bg-[#f7f6f3] text-[#6b7280]" variant="outline">
              EPUB Outline
            </Badge>
            <Badge className="border-[#e8d7c6] bg-[#fdf6ef] text-[#8b6b47]" variant="outline">
              PDF Page Range
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-[1.7rem] border border-[#dce3ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_40px_rgba(147,164,184,0.12)] sm:p-5">
          <div className="grid gap-4">
            <SectionHeading
              description="上传新文档到共享书库，或直接从现有 EPUB / PDF 里挑一本开始提取。"
              eyebrow="Library Shelf"
              title="共享书库"
            />

            <div className="grid gap-3">
              <Button
                className="h-11 justify-start rounded-[1rem] bg-[#162236] text-white hover:bg-[#1c2b44]"
                onClick={() => {
                  triggerFileDialog(fileInputRef.current);
                }}
              >
                <Upload className="size-4" />
                上传 EPUB / PDF
              </Button>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9aa0a9]" />
                <Input
                  className="h-11 rounded-[1rem] border-[#e2e8f0] bg-white pl-10"
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  placeholder="搜索标题、作者、格式..."
                  value={query}
                />
              </div>
            </div>

            {bootstrapStatus === "error" ? (
              <div className="rounded-[1rem] border border-[#e8d7c6] bg-[#fdf6ef] px-4 py-3 text-sm text-[#76543d]">
                {bootstrapError}
              </div>
            ) : null}

            <div className="grid gap-2">
              {filteredDocuments.length ? (
                filteredDocuments.map((document) => {
                  const isActive = document.id === selectedDocumentId;

                  return (
                    <button
                      key={document.id}
                      className={`rounded-[1.1rem] border px-4 py-4 text-left transition-colors ${
                        isActive
                          ? "border-[#c9dbf5] bg-[linear-gradient(180deg,#eef5ff_0%,#e7f0ff_100%)]"
                          : "border-[#e2e8f0] bg-white hover:bg-[#f8fbff]"
                      }`}
                      onClick={() => {
                        setSelectedDocumentId(document.id);
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold text-[#223247]">
                            {document.title}
                          </p>
                          <p className="mt-1 text-xs text-[#788596]">{document.author}</p>
                        </div>
                        <ChevronRight className="mt-1 size-4 shrink-0 text-[#94a3b8]" />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className="border-[#dbe4ef] bg-white text-[#60728c]" variant="outline">
                          {document.format.toUpperCase()}
                        </Badge>
                        <Badge
                          className="border-[#dbe4ef] bg-white text-[#60728c]"
                          variant="outline"
                        >
                          {document.capabilities.outline ? "TOC" : "No TOC"}
                        </Badge>
                        <Badge
                          className="border-[#dbe4ef] bg-white text-[#60728c]"
                          variant="outline"
                        >
                          {document.capabilities.pageRanges ? "Pages" : "Outline Only"}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1.1rem] border border-dashed border-[#d8dee8] bg-white/70 px-4 py-8 text-center text-sm text-[#7b8596]">
                  暂无匹配文档。可以先上传一本 EPUB 或 PDF。
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-5">
          <section className="rounded-[1.7rem] border border-[#dce3ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_40px_rgba(147,164,184,0.12)] sm:p-5">
            <div className="grid gap-4">
              <SectionHeading
                description="先选择提取方式，再配置目录节点或页码区间。按钮状态会随着可用能力和输入合法性自动变化。"
                eyebrow="Workbench"
                title="提取配置"
              />

              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-full"
                  disabled={!analysis?.supportsOutline}
                  onClick={() => {
                    setMode("outline");
                  }}
                  variant={mode === "outline" ? "default" : "outline"}
                >
                  <SquareSplitHorizontal className="size-4" />
                  按目录
                </Button>
                <Button
                  className="rounded-full"
                  disabled={!analysis?.supportsPageRanges}
                  onClick={() => {
                    setMode("pages");
                  }}
                  variant={mode === "pages" ? "default" : "outline"}
                >
                  <FileStack className="size-4" />
                  按页码
                </Button>
              </div>

              {analysisStatus === "loading" ? (
                <div className="flex items-center gap-3 rounded-[1rem] border border-[#d8e2f4] bg-[#eef4ff] px-4 py-4 text-sm text-[#4f6f99]">
                  <LoaderCircle className="size-4 animate-spin" />
                  正在分析 {selectedDocument?.title ?? "文档"} 的目录和页面结构...
                </div>
              ) : null}

              {analysisStatus === "error" ? (
                <div className="rounded-[1rem] border border-[#e8d7c6] bg-[#fdf6ef] px-4 py-4 text-sm text-[#76543d]">
                  {analysisError}
                </div>
              ) : null}

              {analysisStatus === "ready" && analysis ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="grid gap-3">
                    {mode === "outline" ? (
                      analysis.supportsOutline ? (
                        <>
                          <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-[#dbe4ef] bg-[#f8fbff] px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-[#1f2e40]">目录树</p>
                              <p className="mt-1 text-xs leading-5 text-[#6f7b8d]">
                                选中父节点时会自动包含其子节点范围，不需要逐个勾选。
                              </p>
                            </div>
                            <Badge className="border-[#d8e2f4] bg-white text-[#60728c]" variant="outline">
                              {outlineSelection.length} selected
                            </Badge>
                          </div>
                          <OutlineTree
                            nodes={analysis.outline}
                            onToggle={handleToggleOutlineNode}
                            selectedIds={selectedOutlineIds}
                          />
                        </>
                      ) : (
                        <div className="rounded-[1rem] border border-[#e8d7c6] bg-[#fdf6ef] px-4 py-4 text-sm text-[#76543d]">
                          该 PDF 无目录书签，可改用页码范围提取。
                        </div>
                      )
                    ) : (
                      <div className="grid gap-3">
                        <div className="rounded-[1rem] border border-[#dbe4ef] bg-[#f8fbff] px-4 py-3">
                          <p className="text-sm font-medium text-[#1f2e40]">页码区间</p>
                          <p className="mt-1 text-xs leading-5 text-[#6f7b8d]">
                            支持多个连续区间。系统会自动合并重叠或相邻范围，并使用一基页码。
                          </p>
                        </div>

                        {pageRangeInputs.map((value, index) => (
                          <div key={`${index}-${pageRangeInputs.length}`} className="flex gap-2">
                            <Input
                              className="rounded-[1rem] border-[#dbe4ef] bg-white"
                              onChange={(event) => {
                                handleRangeChange(index, event.target.value);
                              }}
                              placeholder={index === 0 ? "例如 20-30" : "例如 45-48"}
                              value={value}
                            />
                            <Button
                              onClick={() => {
                                handleRemoveRange(index);
                              }}
                              size="sm"
                              variant="outline"
                            >
                              删除
                            </Button>
                          </div>
                        ))}

                        <div className="flex flex-wrap gap-2">
                          <Button onClick={handleAddRangeRow} size="sm" variant="outline">
                            新增区间
                          </Button>
                          {pageRangeState.ranges.length ? (
                            <Badge className="border-[#d8e2f4] bg-white text-[#60728c]" variant="outline">
                              规范化后: {formatPageRanges(pageRangeState.ranges).join(", ")}
                            </Badge>
                          ) : null}
                        </div>

                        {pageRangeState.errors.length ? (
                          <div className="rounded-[1rem] border border-[#e8d7c6] bg-[#fdf6ef] px-4 py-3 text-sm text-[#76543d]">
                            {pageRangeState.errors[0]}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <aside className="grid gap-3">
                    <div className="rounded-[1.2rem] border border-[#dbe4ef] bg-white px-4 py-4">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8190a3]">
                        Current
                      </p>
                      <h3 className="mt-2 font-serif text-[1.5rem] leading-[1.02] tracking-[-0.04em] text-[#1f2e40]">
                        {selectedDocument?.title ?? "未选择文档"}
                      </h3>
                      <div className="mt-3 grid gap-1 text-xs leading-5 text-[#6f7b8d]">
                        <span>Format: {selectedDocument?.format.toUpperCase() ?? "-"}</span>
                        <span>
                          Source: {selectedDocument ? formatRelativeTime(selectedDocument.createdAt) : "-"}
                        </span>
                        <span>
                          {mode === "outline"
                            ? `已选目录: ${outlineLabels.length || 0}`
                            : `页码区间: ${pageRangeState.ranges.length || 0}`}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="h-12 rounded-[1rem] bg-[#162236] text-white hover:bg-[#1c2b44]"
                      disabled={extractDisabled}
                      onClick={() => {
                        void handleExtract();
                      }}
                    >
                      {pendingAction === "extract" ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      {pendingAction === "extract" ? "提取中..." : "提取内容"}
                    </Button>

                    {analysis.warnings.length ? (
                      <div className="rounded-[1rem] border border-[#ecf0f7] bg-[#fbfcfe] px-4 py-3 text-xs leading-5 text-[#6f7b8d]">
                        {analysis.warnings[0]}
                      </div>
                    ) : null}
                  </aside>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-[#ddd9cf] bg-[linear-gradient(180deg,#fffefb_0%,#faf7f0_100%)] p-4 shadow-[0_20px_48px_rgba(113,91,66,0.08)] sm:p-5">
            <div className="grid gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <SectionHeading
                  description="结果只保留当前会话，不写入历史记录。复制后不会自动清空，方便继续核对。"
                  eyebrow="Preview Desk"
                  title="结果预览"
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setTelegraphSheetOpen(true);
                    }}
                    variant="outline"
                  >
                    <Settings2 className="size-4" />
                    Telegraph 设置
                  </Button>
                  <Button
                    disabled={telegraphPublishDisabled}
                    onClick={() => {
                      void handlePublishToTelegraph();
                    }}
                    variant="outline"
                  >
                    {pendingAction === "telegraph-publish" ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <TextQuote className="size-4" />
                    )}
                    {pendingAction === "telegraph-publish" ? "发布中..." : "发布到 Telegraph"}
                  </Button>
                  <Button
                    disabled={!result?.text}
                    onClick={() => {
                      void handleCopyResult();
                    }}
                    variant="outline"
                  >
                    <Copy className="size-4" />
                    复制文本
                  </Button>
                  <Button
                    disabled={!result}
                    onClick={() => {
                      setResult(null);
                    }}
                    variant="outline"
                  >
                    清空结果
                  </Button>
                </div>
              </div>

              {result ? (
                <>
                  <div className="rounded-[1.2rem] border border-[#dbe4ef] bg-white px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8190a3]">
                          Publish to Telegraph
                        </p>
                        <h3 className="mt-2 font-serif text-[1.5rem] leading-[1.02] tracking-[-0.04em] text-[#1f2e40]">
                          图文页面导出
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7b8d]">
                          EPUB 会按章节顺序发布图文；PDF 会在含图片页附加整页图像，再跟随该页文字内容。
                        </p>
                      </div>

                      <Badge
                        className={telegraphSettings.configured ? "border-[#d8e2f4] bg-[#eef4ff] text-[#4f6f99]" : "border-[#e8d7c6] bg-[#fdf6ef] text-[#8b6b47]"}
                        variant="outline"
                      >
                        {telegraphSettings.configured ? "Telegraph Ready" : "Needs Setup"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
                      <div className="rounded-[1rem] border border-[#ecf0f7] bg-[#fbfcfe] px-4 py-3 text-sm leading-6 text-[#60728c]">
                        {telegraphSettings.configured ? (
                          <>
                            <p>
                              发布身份: {telegraphSettings.authorName || telegraphSettings.shortName || "未命名账号"}
                            </p>
                            <p className="mt-1">
                              {telegraphPublishResult?.indexPageUrl
                                ? "最近一次发布已生成目录页。"
                                : telegraphPublishResult?.partPages[0]?.url
                                  ? "最近一次发布已生成 Telegraph 页面。"
                                  : "准备好后即可把当前结果发布到 Telegraph。"}
                            </p>
                          </>
                        ) : (
                          <p>当前工作区尚未配置 Telegraph token，先在右上角打开设置保存账号信息。</p>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Button
                          className="h-11 rounded-[1rem] bg-[#162236] text-white hover:bg-[#1c2b44]"
                          disabled={telegraphPublishDisabled}
                          onClick={() => {
                            void handlePublishToTelegraph();
                          }}
                        >
                          {pendingAction === "telegraph-publish" ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <TextQuote className="size-4" />
                          )}
                          {pendingAction === "telegraph-publish" ? "发布中..." : "发布当前结果"}
                        </Button>
                        <Button
                          onClick={() => {
                            setTelegraphSheetOpen(true);
                          }}
                          variant="outline"
                        >
                          <Settings2 className="size-4" />
                          管理 Telegraph 配置
                        </Button>
                      </div>
                    </div>

                    {telegraphPublishResult ? (
                      <div className="mt-4 grid gap-3">
                        <div className="rounded-[1rem] border border-[#e5edf8] bg-[#f8fbff] px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-[#d8e2f4] bg-white text-[#60728c]" variant="outline">
                              {telegraphPublishResult.indexPageUrl ? "目录页" : "单页发布"}
                            </Badge>
                            <Badge className="border-[#d8e2f4] bg-white text-[#60728c]" variant="outline">
                              {telegraphPublishResult.partPages.length} parts
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-[#315171]">
                            {telegraphPublishResult.indexPageUrl ? (
                              <a
                                className="inline-flex items-center gap-2 underline decoration-[#94a3b8] underline-offset-4"
                                href={telegraphPublishResult.indexPageUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                打开目录页
                                <ExternalLink className="size-4" />
                              </a>
                            ) : null}

                            {telegraphPublishResult.partPages.map((part) => (
                              <a
                                className="inline-flex items-center gap-2 underline decoration-[#94a3b8] underline-offset-4"
                                href={part.url}
                                key={part.url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Part {part.partNumber}: {part.title}
                                <ExternalLink className="size-4" />
                              </a>
                            ))}
                          </div>
                        </div>

                        {telegraphPublishResult.warnings.length ? (
                          <div className="rounded-[1rem] border border-[#e8d7c6] bg-[#fdf6ef] px-4 py-3 text-sm text-[#76543d]">
                            {telegraphPublishResult.warnings.join(" ")}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge className="border-[#d8e2f4] bg-[#eef4ff] text-[#4f6f99]" variant="outline">
                      {result.mode === "outline" ? "Outline Extract" : "Page Range Extract"}
                    </Badge>
                    <Badge className="border-[#e2dfd6] bg-white text-[#6b7280]" variant="outline">
                      {result.sourceCount} sources
                    </Badge>
                    <Badge className="border-[#e2dfd6] bg-white text-[#6b7280]" variant="outline">
                      {result.charCount} chars
                    </Badge>
                  </div>

                  <div className="rounded-[1rem] border border-[#e7dfd2] bg-[#fdfaf3] px-4 py-3 text-xs leading-5 text-[#6f6457]">
                    {result.selectionSummary.length
                      ? `本次范围: ${result.selectionSummary.join(" / ")}`
                      : "本次范围为空"}
                  </div>

                  {result.warnings.length ? (
                    <div className="rounded-[1rem] border border-[#e8d7c6] bg-[#fdf6ef] px-4 py-3 text-sm text-[#76543d]">
                      {result.warnings.join(" ")}
                    </div>
                  ) : null}

                  {epubDocument && epubSourceBuffer && epubPreviewSections.length ? (
                    <div className="grid gap-3">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8190a3]">
                          EPUB Surface
                        </p>
                        <h3 className="mt-2 font-serif text-[1.5rem] leading-[1.02] tracking-[-0.04em] text-[#1f2e40]">
                          原始章节预览
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7b8d]">
                          这里使用 `epub.js` 直接渲染你刚刚提取的章节内容，所以插图、SVG 和章节内样式会尽量按原书展示。
                        </p>
                      </div>

                      <EpubPreviewSurface
                        documentId={result.documentId}
                        sections={epubPreviewSections}
                        sourceBuffer={epubSourceBuffer}
                      />
                    </div>
                  ) : null}

                  {result.blocks.length ? (
                    <div className="grid gap-4 rounded-[1.3rem] border border-[#eadfce] bg-[#fffdf8] px-4 py-5 sm:px-6">
                      {epubDocument ? (
                        <div className="border-b border-[#eee2d0] pb-1">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8190a3]">
                            Structured Summary
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#6f7b8d]">
                            下方仍保留结构化摘要，方便复制纯文本、核对章节边界和继续发布到 Telegraph。
                          </p>
                        </div>
                      ) : null}

                      {result.blocks.map((block, index) => (
                        <ResultBlockView
                          block={block}
                          key={`${block.type}-${index}-${"text" in block ? block.text : "label" in block ? block.label : block.assetId}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[1.2rem] border border-dashed border-[#dccfbf] bg-[#fffaf2] px-4 py-10 text-center text-sm text-[#8b6b47]">
                      当前结果没有可显示的正文，可能是空白页或扫描 PDF。
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-[#dccfbf] bg-[#fffaf2] px-4 py-12 text-center text-sm text-[#8b6b47]">
                  选择文档并配置目录或页码范围后，结果会显示在这里。
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
