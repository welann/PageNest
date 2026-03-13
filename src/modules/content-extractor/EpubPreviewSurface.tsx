import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

import { Badge } from "@components/ui/badge";

interface EpubSectionLike {
  render: (request?: Function) => Promise<string>;
}

interface EpubBookLike {
  destroy?: () => void;
  ready: Promise<void>;
  request: Function;
  section: (target: string | number) => EpubSectionLike | null;
}

interface RenderedPreviewSection {
  href: string;
  markup: string;
  title: string;
}

interface EpubPreviewSurfaceProps {
  documentId: number;
  sections: Array<{
    href: string;
    title: string;
  }>;
  sourceBuffer: ArrayBuffer;
}

const DEFAULT_FRAME_HEIGHT = 360;

export function sanitizeRawRenderedMarkup(markup: string) {
  return markup
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .trim();
}

function buildInjectedPreviewStyles() {
  return `
    :root {
      color-scheme: light;
    }

    html, body {
      margin: 0;
      min-height: 100%;
      background: transparent;
      color: #223247;
    }

    body {
      padding: 1rem 1rem 1.25rem;
      overflow-wrap: anywhere;
    }

    img, svg, video, canvas {
      display: block;
      max-width: 100% !important;
      height: auto !important;
      margin-inline: auto;
    }

    figure {
      margin: 1.1rem 0;
    }

    figcaption {
      margin-top: 0.65rem;
      color: #6f5a40;
      font-size: 0.92rem;
      line-height: 1.6;
    }

    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    table {
      max-width: 100%;
    }
  `;
}

function parseRenderedSectionDocument(markup: string) {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  const parser = new DOMParser();
  return parser.parseFromString(sanitizeRawRenderedMarkup(markup), "text/html");
}

function ensureHtmlStructure(document: Document) {
  let html = document.documentElement;

  if (!html || html.tagName.toLowerCase() !== "html") {
    html = document.createElement("html");

    while (document.firstChild) {
      html.appendChild(document.firstChild);
    }

    document.appendChild(html);
  }

  let head = Array.from(document.getElementsByTagName("head"))[0];

  if (!head) {
    head = document.createElement("head");

    if (html.firstChild) {
      html.insertBefore(head, html.firstChild);
    } else {
      html.appendChild(head);
    }
  }

  let body = Array.from(document.getElementsByTagName("body"))[0];

  if (!body) {
    body = document.createElement("body");

    while (head.nextSibling) {
      body.appendChild(head.nextSibling);
    }

    html.appendChild(body);
  }

  return {
    body,
    head,
    html
  };
}

export function prepareRenderedEpubPreviewMarkup(markup: string) {
  const sanitizedMarkup = sanitizeRawRenderedMarkup(markup);
  const document = parseRenderedSectionDocument(markup);

  if (!document) {
    return sanitizedMarkup.replace(/<script[\s\S]*?<\/script>/gi, "");
  }

  Array.from(document.getElementsByTagName("script")).forEach((scriptNode) => {
    scriptNode.parentNode?.removeChild(scriptNode);
  });

  const { head, html } = ensureHtmlStructure(document);
  const viewport = document.createElement("meta");
  viewport.setAttribute("name", "viewport");
  viewport.setAttribute("content", "width=device-width, initial-scale=1");
  head.appendChild(viewport);

  const style = document.createElement("style");
  style.textContent = buildInjectedPreviewStyles();
  head.appendChild(style);

  if ("outerHTML" in html && typeof html.outerHTML === "string") {
    return `<!DOCTYPE html>${html.outerHTML}`;
  }

  if (typeof XMLSerializer === "undefined") {
    return sanitizedMarkup.replace(/<script[\s\S]*?<\/script>/gi, "");
  }

  return `<!DOCTYPE html>${new XMLSerializer().serializeToString(document)}`;
}

function normalizePreviewFrameHeight(height: number) {
  return Math.min(Math.max(Math.ceil(height), 180), 2800);
}

function measurePreviewFrame(iframe: HTMLIFrameElement | null) {
  const document = iframe?.contentDocument;

  if (!document) {
    return DEFAULT_FRAME_HEIGHT;
  }

  const root = document.documentElement;
  const body = document.body;
  const measuredHeight = Math.max(
    root?.scrollHeight ?? 0,
    root?.offsetHeight ?? 0,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0
  );

  return normalizePreviewFrameHeight(measuredHeight || DEFAULT_FRAME_HEIGHT);
}

function EpubPreviewFrame({
  markup,
  title
}: {
  markup: string;
  title: string;
}) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(DEFAULT_FRAME_HEIGHT);

  const syncHeight = useEffectEvent(() => {
    const nextHeight = measurePreviewFrame(iframeRef.current);

    setHeight((current) => (current === nextHeight ? current : nextHeight));
  });

  const handleLoad = useEffectEvent(() => {
    cleanupRef.current?.();
    syncHeight();

    const iframe = iframeRef.current;
    const document = iframe?.contentDocument;

    if (!iframe || !document) {
      return;
    }

    const cleanups: Array<() => void> = [];
    const images = Array.from(document.images);

    images.forEach((image) => {
      image.addEventListener("load", syncHeight);
      image.addEventListener("error", syncHeight);
      cleanups.push(() => {
        image.removeEventListener("load", syncHeight);
        image.removeEventListener("error", syncHeight);
      });
    });

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => {
        syncHeight();
      });

      if (document.documentElement) {
        resizeObserver.observe(document.documentElement);
      }

      if (document.body) {
        resizeObserver.observe(document.body);
      }

      cleanups.push(() => {
        resizeObserver.disconnect();
      });
    }

    const timerId = window.setTimeout(() => {
      syncHeight();
    }, 140);
    cleanups.push(() => {
      window.clearTimeout(timerId);
    });

    cleanupRef.current = () => {
      cleanups.forEach((cleanup) => {
        cleanup();
      });
    };
  });

  useEffect(() => {
    setHeight(DEFAULT_FRAME_HEIGHT);

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [markup]);

  return (
    <iframe
      className="w-full rounded-[1rem] bg-transparent"
      loading="lazy"
      onLoad={() => {
        handleLoad();
      }}
      ref={iframeRef}
      sandbox="allow-same-origin"
      srcDoc={markup}
      style={{ height }}
      title={title}
    />
  );
}

export function EpubPreviewSurface({
  documentId,
  sections,
  sourceBuffer
}: EpubPreviewSurfaceProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [renderedSections, setRenderedSections] = useState<RenderedPreviewSection[]>([]);
  const [status, setStatus] = useState<"error" | "idle" | "loading" | "ready">("idle");

  useEffect(() => {
    if (!sections.length || !sourceBuffer.byteLength) {
      setRenderedSections([]);
      setStatus("idle");
      setErrorMessage("");
      return;
    }

    let cancelled = false;
    let book: EpubBookLike | null = null;

    async function renderSections() {
      setStatus("loading");
      setErrorMessage("");

      try {
        const epubModule = await import("epubjs");
        const createBook = epubModule.default as unknown as (
          input: string | ArrayBuffer,
          options?: Record<string, unknown>
        ) => EpubBookLike;

        book = createBook(sourceBuffer.slice(0), {
          openAs: "binary",
          replacements: "base64"
        });

        await book.ready;

        const nextSections: RenderedPreviewSection[] = [];

        for (const section of sections) {
          const chapter = book.section(section.href);

          if (!chapter) {
            continue;
          }

          const markup = await chapter.render(book.request);

          if (cancelled) {
            return;
          }

          nextSections.push({
            href: section.href,
            markup: prepareRenderedEpubPreviewMarkup(markup),
            title: section.title
          });
        }

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setRenderedSections(nextSections);
          setStatus("ready");
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setRenderedSections([]);
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "EPUB 预览渲染失败。");
        });
      }
    }

    void renderSections();

    return () => {
      cancelled = true;
      book?.destroy?.();
    };
  }, [documentId, sections, sourceBuffer]);

  if (status === "loading") {
    return (
      <div className="rounded-[1.2rem] border border-[#dbe4ef] bg-[#f8fbff] px-4 py-5 text-sm text-[#4f6f99]">
        正在使用 `epub.js` 渲染你选中的章节内容与插图...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-[1.2rem] border border-[#e8d7c6] bg-[#fdf6ef] px-4 py-5 text-sm text-[#76543d]">
        {errorMessage || "EPUB 预览暂时不可用。"}
      </div>
    );
  }

  if (!renderedSections.length) {
    return (
      <div className="rounded-[1.2rem] border border-dashed border-[#dccfbf] bg-[#fffaf2] px-4 py-8 text-center text-sm text-[#8b6b47]">
        当前结果没有可显示的 EPUB 章节。
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge className="border-[#d8e2f4] bg-[#eef4ff] text-[#4f6f99]" variant="outline">
          EPUB.js Preview
        </Badge>
        <Badge className="border-[#e2dfd6] bg-white text-[#6b7280]" variant="outline">
          {renderedSections.length} sections
        </Badge>
      </div>

      {renderedSections.map((section, index) => (
        <article
          className="overflow-hidden rounded-[1.25rem] border border-[#eadfce] bg-[#fffdf8] shadow-[0_10px_24px_rgba(113,91,66,0.05)]"
          key={`${section.href}-${index}`}
        >
          <div className="border-b border-[#eee2d0] bg-[#f9f2e9] px-4 py-3">
            <p className="text-sm font-medium text-[#4d453c]">{section.title}</p>
            <p className="mt-1 text-xs text-[#8b7b67]">{section.href}</p>
          </div>

          <div className="bg-[linear-gradient(180deg,#ffffff_0%,#fffdf8_100%)] px-3 py-3 sm:px-4">
            <EpubPreviewFrame markup={section.markup} title={section.title} />
          </div>
        </article>
      ))}
    </div>
  );
}
