import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  BookOpenText,
  ChevronRight,
  Copy,
  FileStack,
  LoaderCircle,
  Search,
  Sparkles,
  SquareSplitHorizontal,
  Upload
} from "lucide-react";
import { toast } from "sonner";

import { useSetActiveSidebarSlot } from "@components/shell/moduleShell";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { ExtractorSidebarPanel } from "@modules/content-extractor/ExtractorSidebar";
import { analyzeEpubArchive, extractEpubByOutline, type ParsedEpubDocument } from "@shared/extractor/epubSelection";
import { parseEpubArchive } from "@shared/extractor/epubArchive";
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
  ExtractorResultBlock
} from "@shared/types/extractor";
import { formatRelativeTime } from "@shared/utils/format";
import { getReaderBookFileUrl } from "@services/api/reader";
import { getExtractorBootstrap, importExtractorDocument } from "@services/api/extractor";

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

function ResultBlockView({ block }: { block: ExtractorResultBlock }) {
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
  const [pendingAction, setPendingAction] = useState<"analyze" | "copy" | "extract" | "upload" | null>(null);
  const [query, setQuery] = useState("");

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
  const analysis = preparedDocument?.value.analysis ?? null;
  const selectedOutlineIds = useMemo(() => new Set(outlineSelection), [outlineSelection]);
  const pageRangeState = useMemo(
    () => parsePageRangeInputs(pageRangeInputs, analysis?.pageCount ?? null),
    [analysis?.pageCount, pageRangeInputs]
  );

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
    setPreparedDocument(null);
    setAnalysisStatus(selectedDocument ? "loading" : "idle");
    setAnalysisError("");
  }, [selectedDocumentId]);

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
          setMode(parsed.analysis.supportsOutline ? "outline" : "pages");
          setAnalysisStatus("ready");
        });
      } catch (error) {
        if (analysisRequestRef.current !== requestId) {
          return;
        }

        startTransition(() => {
          setPreparedDocument(null);
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

                  {result.blocks.length ? (
                    <div className="grid gap-4 rounded-[1.3rem] border border-[#eadfce] bg-[#fffdf8] px-4 py-5 sm:px-6">
                      {result.blocks.map((block, index) => (
                        <ResultBlockView
                          block={block}
                          key={`${block.type}-${index}-${"text" in block ? block.text : block.label}`}
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
