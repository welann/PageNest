import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  collectUnknownWords,
  evaluateWord,
  extractWordTokens,
  type UnknownWordAggregate,
  type VocabularyLookup
} from "@shared/reader/vocabulary";
import type { ReaderBookSummary } from "@shared/types/reader";
import { getReaderBookFileUrl } from "@services/api/reader";

import styles from "@modules/ebook-reader/view.module.css";

interface ReaderViewportProps {
  book: ReaderBookSummary;
  lookup: VocabularyLookup;
  onProgressChange: (payload: {
    itemId: number;
    locator: string;
    progressPercent: number;
  }) => void | Promise<void>;
  onVisibleWordsChange: (words: UnknownWordAggregate[]) => void;
  onWordSelect: (lemma: string, surface: string) => void;
}

interface EpubSectionLike {
  href: string;
  index: number;
  linear?: boolean;
}

interface EpubBookLike {
  destroy?: () => void;
  locations?: {
    generate: (chars: number) => Promise<unknown>;
    locationFromCfi?: (cfi: string) => number;
    percentageFromCfi?: (cfi: string) => number;
  };
  ready: Promise<void>;
  renderTo: (element: Element, options: Record<string, unknown>) => EpubRenditionLike;
  spine?: {
    each: (callback: (section: EpubSectionLike) => void) => void;
  };
}

interface EpubContentsLike {
  addStylesheetCss?: (serializedCss: string, key?: string) => boolean | void;
  cfiFromRange?: (range: Range, ignoreClass?: string) => string;
  css?: (property: string, value?: string, priority?: boolean) => void;
  document: Document;
}

interface EpubAnnotationManagerLike {
  highlight: (
    cfiRange: string,
    data: Record<string, string>,
    callback?: () => void,
    className?: string,
    styles?: Record<string, string>
  ) => unknown;
  remove: (cfiRange: string, type?: string) => void;
}

interface EpubRenditionLike {
  annotations?: EpubAnnotationManagerLike;
  currentLocation?: () => RelocatedPayload | undefined;
  destroy?: () => void;
  display: (target?: number | string) => Promise<unknown>;
  getContents?: () => EpubContentsLike[] | EpubContentsLike;
  hooks: {
    content: {
      register: (callback: (contents: EpubContentsLike) => void) => void;
    };
  };
  next: () => Promise<unknown>;
  on: (eventName: string, handler: (payload: unknown) => void) => void;
  prev: () => Promise<unknown>;
  resize?: (width?: number, height?: number, epubcfi?: string) => void;
}

interface RelocatedPayload {
  end?: {
    displayed?: {
      page?: number;
      total?: number;
    };
  };
  start?: {
    cfi?: string;
    displayed?: {
      page?: number;
      total?: number;
    };
    index?: number;
    percentage?: number;
  };
}

interface VisibleWordHighlight {
  cfiRange: string;
  lemma: string;
  surface: string;
}

interface VisibleWordSnapshot {
  highlights: VisibleWordHighlight[];
  words: UnknownWordAggregate[];
}

interface BookPageIndex {
  sectionStartPages: Record<number, number>;
  totalPages: number;
}

const INLINE_HIGHLIGHT_BLOCKLIST =
  "h1, h2, h3, h4, h5, h6, small, sup, sub, figcaption, caption, code, pre";
const CONTENT_HIGHLIGHT_CLASS = "pn-reader-word-overlay";
const CONTENT_HIGHLIGHT_STYLES = {
  fill: "#b56e3b",
  "fill-opacity": "0.18",
  "mix-blend-mode": "multiply"
};
const DIRECT_WORD_SELECTION_PATTERN = /^[A-Za-z]+(?:'[A-Za-z]+)*$/;
const FONT_SCALE_STORAGE_KEY = "pn-reader-font-scale";
const MIN_FONT_SCALE = 90;
const MAX_FONT_SCALE = 180;
const FONT_SCALE_STEP = 10;
const DEFAULT_FONT_SCALE = 120;
const READER_THEME_NAME = "pn-reader";
const READER_TEXT_SELECTOR =
  "body, p, div, li, dt, dd, blockquote, article, section, aside, main, td, th";
const READER_INLINE_SELECTOR = "span, a, em, strong, b, i, u, cite, q, small, sup, sub";

function clampFontScale(value: number) {
  const safeValue = Number.isFinite(value) ? value : DEFAULT_FONT_SCALE;

  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, Math.round(safeValue)));
}

function readStoredFontScale() {
  if (typeof window === "undefined") {
    return DEFAULT_FONT_SCALE;
  }

  const rawValue = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);

  if (!rawValue) {
    return DEFAULT_FONT_SCALE;
  }

  return clampFontScale(Number.parseInt(rawValue, 10));
}

function shouldSkipSurface(surface: string) {
  if (!surface) {
    return true;
  }

  if (
    surface.length === 1 &&
    surface !== "a" &&
    surface !== "A" &&
    surface !== "I" &&
    surface !== "i"
  ) {
    return true;
  }

  return false;
}

function buildSampleContext(text: string, start: number, end: number) {
  const contextStart = Math.max(0, start - 48);
  const contextEnd = Math.min(text.length, end + 48);
  return text.slice(contextStart, contextEnd).replace(/\s+/g, " ").trim();
}

function buildReaderThemeRules() {
  return `
    html {
      -webkit-text-size-adjust: 100%;
    }

    body {
      line-height: 1.72 !important;
      margin: 0 !important;
      text-rendering: optimizeLegibility;
    }

    ${READER_TEXT_SELECTOR} {
      font-size: 1em !important;
      line-height: inherit !important;
      max-width: 100%;
    }

    ${READER_INLINE_SELECTOR} {
      font-size: inherit !important;
      line-height: inherit !important;
    }

    h1 {
      font-size: 2em !important;
      line-height: 1.25 !important;
    }

    h2 {
      font-size: 1.7em !important;
      line-height: 1.3 !important;
    }

    h3,
    h4,
    h5,
    h6 {
      line-height: 1.35 !important;
    }

    img,
    svg,
    video,
    canvas {
      max-width: 100% !important;
      height: auto;
    }
  `;
}

function applyContentTypography(contents: EpubContentsLike, scale: number) {
  const normalizedScale = clampFontScale(scale);

  contents.document.documentElement.style.setProperty(
    "-webkit-text-size-adjust",
    "100%"
  );
  contents.addStylesheetCss?.(buildReaderThemeRules(), READER_THEME_NAME);
  contents.css?.("font-size", `${normalizedScale}%`, true);
  contents.css?.("line-height", "1.72", true);
  contents.css?.("margin", "0", true);
}

function extractSelectedSurface(rawSelection: string) {
  const selection = rawSelection.trim();

  if (!selection) {
    return null;
  }

  if (DIRECT_WORD_SELECTION_PATTERN.test(selection)) {
    return selection;
  }

  const matches = selection.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g);

  if (!matches || matches.length !== 1) {
    return null;
  }

  return matches[0];
}

function rectsIntersect(
  left: Pick<DOMRect, "top" | "right" | "bottom" | "left">,
  right: Pick<DOMRect, "top" | "right" | "bottom" | "left">
) {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

function toContentsArray(value: EpubContentsLike[] | EpubContentsLike | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function mergeUnknownWords(groups: UnknownWordAggregate[][]) {
  const merged = new Map<string, UnknownWordAggregate>();

  for (const group of groups) {
    for (const word of group) {
      const existing = merged.get(word.lemma);

      if (existing) {
        existing.occurrenceCount += word.occurrenceCount;

        for (const surfaceForm of word.surfaceForms) {
          if (!existing.surfaceForms.includes(surfaceForm)) {
            existing.surfaceForms.push(surfaceForm);
          }
        }

        continue;
      }

      merged.set(word.lemma, {
        ...word,
        surfaceForms: [...word.surfaceForms]
      });
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    if (right.occurrenceCount !== left.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }

    return left.lemma.localeCompare(right.lemma);
  });
}

function getViewportSize(element: HTMLElement) {
  const bounds = element.getBoundingClientRect();

  return {
    height: Math.max(Math.floor(bounds.height), 1),
    width: Math.max(Math.floor(bounds.width), 1)
  };
}

function collectVisibleUnknownWords(
  contents: EpubContentsLike,
  lookup: VocabularyLookup,
  viewportRect: DOMRect
): VisibleWordSnapshot {
  const document = contents.document;
  const root = document.body;
  const frameElement = document.defaultView?.frameElement;

  if (!root || !(frameElement instanceof HTMLElement)) {
    const text = root?.innerText ?? root?.textContent ?? "";

    return {
      highlights: [],
      words: collectUnknownWords(text, lookup)
    };
  }

  const frameRect = frameElement.getBoundingClientRect();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentElement = node.parentElement;

      if (!parentElement || !node.textContent?.trim()) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parentElement.closest(INLINE_HIGHLIGHT_BLOCKLIST)) {
        return NodeFilter.FILTER_REJECT;
      }

      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parentElement.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      return /[A-Za-z]/.test(node.textContent)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });
  const aggregated = new Map<string, UnknownWordAggregate>();
  const highlightKeys = new Set<string>();
  const highlights: VisibleWordHighlight[] = [];

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const sourceText = textNode.textContent ?? "";
    const tokens = extractWordTokens(sourceText);

    for (const token of tokens) {
      if (shouldSkipSurface(token.surface)) {
        continue;
      }

      const range = document.createRange();
      range.setStart(textNode, token.start);
      range.setEnd(textNode, token.end);

      const isVisible = Array.from(range.getClientRects()).some((rect) => {
        if (rect.width <= 0 || rect.height <= 0) {
          return false;
        }

        return rectsIntersect(
          {
            top: frameRect.top + rect.top,
            right: frameRect.left + rect.right,
            bottom: frameRect.top + rect.bottom,
            left: frameRect.left + rect.left
          },
          viewportRect
        );
      });

      if (!isVisible) {
        continue;
      }

      const decision = evaluateWord(token.surface, lookup);

      if (decision.ignored || decision.isLearned) {
        continue;
      }

      const cfiRange = contents.cfiFromRange?.(range);

      if (cfiRange) {
        const highlightKey = `${cfiRange}:${decision.lemma}`;

        if (!highlightKeys.has(highlightKey)) {
          highlightKeys.add(highlightKey);
          highlights.push({
            cfiRange,
            lemma: decision.lemma,
            surface: token.surface
          });
        }
      }

      const existing = aggregated.get(decision.lemma);

      if (existing) {
        existing.occurrenceCount += 1;

        if (!existing.surfaceForms.includes(token.surface)) {
          existing.surfaceForms.push(token.surface);
        }

        continue;
      }

      aggregated.set(decision.lemma, {
        lemma: decision.lemma,
        surfaceForms: [token.surface],
        definition: decision.definition,
        partOfSpeech: decision.partOfSpeech,
        note: decision.note,
        phonetic: decision.phonetic,
        occurrenceCount: 1,
        sampleContext: buildSampleContext(sourceText, token.start, token.end)
      });
    }
  }

  return {
    highlights,
    words: Array.from(aggregated.values()).sort((left, right) => {
      if (right.occurrenceCount !== left.occurrenceCount) {
        return right.occurrenceCount - left.occurrenceCount;
      }

      return left.lemma.localeCompare(right.lemma);
    })
  };
}

async function buildBookPageIndex(
  fileBuffer: ArrayBuffer,
  createBook: (input: string | ArrayBuffer, options?: Record<string, unknown>) => EpubBookLike,
  width: number,
  height: number,
  fontScale: number,
  isCancelled: () => boolean
) {
  if (!width || !height) {
    return null;
  }

  const measurementMount = document.createElement("div");
  measurementMount.style.position = "fixed";
  measurementMount.style.left = "-99999px";
  measurementMount.style.top = "0";
  measurementMount.style.width = `${width}px`;
  measurementMount.style.height = `${height}px`;
  measurementMount.style.overflow = "hidden";
  measurementMount.style.pointerEvents = "none";
  measurementMount.style.opacity = "0";
  document.body.appendChild(measurementMount);

  const measurementBook = createBook(fileBuffer.slice(0), {
    openAs: "binary",
    replacements: "base64"
  });
  const measurementRendition = measurementBook.renderTo(measurementMount, {
    allowScriptedContent: false,
    flow: "paginated",
    height,
    manager: "default",
    spread: "none",
    view: "iframe",
    width
  });

  try {
    await measurementBook.ready;

    const sections: EpubSectionLike[] = [];
    measurementBook.spine?.each((section) => {
      if (section.linear !== false) {
        sections.push(section);
      }
    });

    const sectionStartPages: Record<number, number> = {};
    let totalPages = 0;

    for (const section of sections) {
      if (isCancelled()) {
        return null;
      }

      await measurementRendition.display(section.href);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      toContentsArray(measurementRendition.getContents?.()).forEach((contents) => {
        applyContentTypography(contents, fontScale);
      });
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      const located = measurementRendition.currentLocation?.();
      const sectionPages = Math.max(
        located?.start?.displayed?.total ?? located?.end?.displayed?.total ?? 1,
        1
      );

      sectionStartPages[section.index] = totalPages + 1;
      totalPages += sectionPages;
    }

    return {
      sectionStartPages,
      totalPages: Math.max(totalPages, 1)
    };
  } finally {
    measurementRendition.destroy?.();
    measurementBook.destroy?.();
    measurementMount.remove();
  }
}

export function ReaderViewport({
  book,
  lookup,
  onProgressChange,
  onVisibleWordsChange,
  onWordSelect
}: ReaderViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<EpubBookLike | null>(null);
  const renditionRef = useRef<EpubRenditionLike | null>(null);
  const sourceBufferRef = useRef<ArrayBuffer | null>(null);
  const createBookRef = useRef<
    | ((
        input: string | ArrayBuffer,
        options?: Record<string, unknown>
      ) => EpubBookLike)
    | null
  >(null);
  const progressTimerRef = useRef<number | null>(null);
  const reflowTimerRef = useRef<number | null>(null);
  const pageIndexJobRef = useRef(0);
  const fontScaleRef = useRef(DEFAULT_FONT_SCALE);
  const appliedFontScaleRef = useRef<number | null>(null);
  const activeHighlightCfisRef = useRef<string[]>([]);
  const pageIndexRef = useRef<BookPageIndex | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [pageLabel, setPageLabel] = useState("Preparing book…");
  const [progressLabel, setProgressLabel] = useState(
    book.progress ? `${book.progress.progressPercent}%` : "0%"
  );
  const [fontScale, setFontScale] = useState(readStoredFontScale);
  const [isReflowing, setIsReflowing] = useState(false);

  const clearProgressTimer = useEffectEvent(() => {
    if (progressTimerRef.current !== null) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  });

  const clearReflowTimer = useEffectEvent(() => {
    if (reflowTimerRef.current !== null) {
      window.clearTimeout(reflowTimerRef.current);
      reflowTimerRef.current = null;
    }
  });

  const applyTypography = useEffectEvent((scale: number) => {
    const normalizedScale = clampFontScale(scale);
    const rendition = renditionRef.current;

    if (rendition) {
      toContentsArray(rendition.getContents?.()).forEach((contents) => {
        applyContentTypography(contents, normalizedScale);
      });
    }

    appliedFontScaleRef.current = normalizedScale;
  });

  const clearVisibleHighlights = useEffectEvent(() => {
    const rendition = renditionRef.current;

    if (rendition?.annotations) {
      for (const cfiRange of activeHighlightCfisRef.current) {
        rendition.annotations.remove(cfiRange, "highlight");
      }
    }

    activeHighlightCfisRef.current = [];
  });

  const applyVisibleHighlights = useEffectEvent((highlights: VisibleWordHighlight[]) => {
    const rendition = renditionRef.current;

    if (!rendition?.annotations) {
      activeHighlightCfisRef.current = [];
      return;
    }

    const currentCfis = new Set(activeHighlightCfisRef.current);
    const nextHighlights = new Map(
      highlights.map((highlight) => [highlight.cfiRange, highlight])
    );

    for (const cfiRange of activeHighlightCfisRef.current) {
      if (!nextHighlights.has(cfiRange)) {
        rendition.annotations.remove(cfiRange, "highlight");
      }
    }

    for (const [cfiRange, highlight] of nextHighlights) {
      if (currentCfis.has(cfiRange)) {
        continue;
      }

      rendition.annotations.highlight(
        cfiRange,
        {
          lemma: highlight.lemma,
          surface: highlight.surface
        },
        () => {
          onWordSelect(highlight.lemma, highlight.surface);
        },
        CONTENT_HIGHLIGHT_CLASS,
        CONTENT_HIGHLIGHT_STYLES
      );
    }

    activeHighlightCfisRef.current = Array.from(nextHighlights.keys());
  });

  const refreshVisibleWords = useEffectEvent(() => {
    const rendition = renditionRef.current;
    const viewportRect = containerRef.current?.getBoundingClientRect();

    if (!rendition) {
      clearVisibleHighlights();
      onVisibleWordsChange([]);
      return;
    }

    const snapshots = toContentsArray(rendition.getContents?.()).map((contents) => {
      if (!viewportRect) {
        return {
          highlights: [],
          words: collectUnknownWords(
            contents.document.body?.innerText ?? contents.document.body?.textContent ?? "",
            lookup
          )
        };
      }

      return collectVisibleUnknownWords(contents, lookup, viewportRect);
    });

    applyVisibleHighlights(snapshots.flatMap((snapshot) => snapshot.highlights));
    onVisibleWordsChange(mergeUnknownWords(snapshots.map((snapshot) => snapshot.words)));
  });

  const handleDirectSelection = useEffectEvent((contents: EpubContentsLike) => {
    const selection = contents.document.defaultView?.getSelection();

    if (!selection || selection.isCollapsed) {
      return;
    }

    const surface = extractSelectedSurface(selection.toString());

    if (!surface || shouldSkipSurface(surface)) {
      return;
    }

    const decision = evaluateWord(surface, lookup);

    if (decision.ignored) {
      return;
    }

    onWordSelect(decision.lemma, surface);
  });

  const handleRelocated = useEffectEvent((payload: unknown) => {
    const relocated = payload as RelocatedPayload;
    const cfi = relocated.start?.cfi;
    const sectionIndex = relocated.start?.index;
    const sectionPage = relocated.start?.displayed?.page;
    const sectionTotal = relocated.start?.displayed?.total;
    const pageIndex = pageIndexRef.current;
    const sectionStartPage =
      typeof sectionIndex === "number"
        ? pageIndex?.sectionStartPages[sectionIndex]
        : undefined;
    const rawPercentage =
      cfi && bookRef.current?.locations?.percentageFromCfi
        ? bookRef.current.locations.percentageFromCfi(cfi)
        : relocated.start?.percentage;
    const progressPercent = Number.isFinite(rawPercentage)
      ? Math.max(0, Math.min(100, Math.round(Number(rawPercentage) * 1000) / 10))
      : 0;

    if (sectionStartPage && typeof sectionPage === "number" && pageIndex) {
      setPageLabel(`Page ${sectionStartPage + sectionPage - 1} / ${pageIndex.totalPages}`);
    } else if (typeof sectionPage === "number" && typeof sectionTotal === "number") {
      setPageLabel(`Page ${sectionPage} / ${sectionTotal}`);
    } else {
      setPageLabel("Paginated reading");
    }

    setProgressLabel(`${progressPercent}%`);
    refreshVisibleWords();

    if (!cfi) {
      return;
    }

    clearProgressTimer();
    progressTimerRef.current = window.setTimeout(() => {
      void onProgressChange({
        itemId: book.id,
        locator: cfi,
        progressPercent
      });
    }, 450);
  });

  const rebuildPageIndex = useEffectEvent(async () => {
    const sourceBuffer = sourceBufferRef.current;
    const createBook = createBookRef.current;
    const mountElement = containerRef.current;

    if (!sourceBuffer || !createBook || !mountElement) {
      return;
    }

    const nextJob = pageIndexJobRef.current + 1;
    pageIndexJobRef.current = nextJob;
    pageIndexRef.current = null;
    setIsReflowing(true);
    const viewportSize = getViewportSize(mountElement);
    const nextPageIndex = await buildBookPageIndex(
      sourceBuffer,
      createBook,
      viewportSize.width,
      viewportSize.height,
      fontScaleRef.current,
      () => pageIndexJobRef.current !== nextJob
    );

    if (!nextPageIndex || pageIndexJobRef.current !== nextJob) {
      if (pageIndexJobRef.current === nextJob) {
        setIsReflowing(false);
      }
      return;
    }

    pageIndexRef.current = nextPageIndex;
    setIsReflowing(false);
    const currentLocation = renditionRef.current?.currentLocation?.();

    if (currentLocation) {
      handleRelocated(currentLocation);
    }
  });

  useEffect(() => {
    fontScaleRef.current = clampFontScale(fontScale);
  }, [fontScale]);

  useEffect(() => {
    window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(clampFontScale(fontScale)));
  }, [fontScale]);

  useEffect(() => {
    const abortController = new AbortController();
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function loadBook() {
      if (!containerRef.current) {
        return;
      }

      setStatus("loading");
      setErrorMessage("");
      setPageLabel("Preparing book…");
      setProgressLabel(book.progress ? `${book.progress.progressPercent}%` : "0%");
      setIsReflowing(true);
      onVisibleWordsChange([]);
      pageIndexRef.current = null;
      pageIndexJobRef.current += 1;
      clearVisibleHighlights();

      try {
        const viewportSize = getViewportSize(containerRef.current);
        const response = await fetch(getReaderBookFileUrl(book.id), {
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error("Book file could not be loaded from Cloudflare R2.");
        }

        const fileBuffer = await response.arrayBuffer();
        const epubModule = await import("epubjs");
        const createBook = epubModule.default as unknown as (
          input: string | ArrayBuffer,
          options?: Record<string, unknown>
        ) => EpubBookLike;
        createBookRef.current = createBook;
        sourceBufferRef.current = fileBuffer;
        const nextBook = createBook(fileBuffer, {
          openAs: "binary",
          replacements: "base64"
        });
        const nextRendition = nextBook.renderTo(containerRef.current, {
          allowScriptedContent: false,
          flow: "paginated",
          height: viewportSize.height,
          manager: "default",
          spread: "none",
          view: "iframe",
          width: viewportSize.width
        });

        nextRendition.on("rendered", () => {
          applyTypography(fontScaleRef.current);
          refreshVisibleWords();
        });
        nextRendition.on("relocated", (payload) => {
          handleRelocated(payload);
        });
        nextRendition.hooks.content.register((contents) => {
          applyContentTypography(contents, fontScaleRef.current);

          const onMouseUp = () => {
            window.setTimeout(() => {
              handleDirectSelection(contents);
            }, 0);
          };
          const onTouchEnd = () => {
            window.setTimeout(() => {
              handleDirectSelection(contents);
            }, 0);
          };

          contents.document.addEventListener("mouseup", onMouseUp);
          contents.document.addEventListener("touchend", onTouchEnd, {
            passive: true
          });
        });

        await nextBook.ready;
        await nextBook.locations?.generate(1600);

        if (cancelled) {
          return;
        }

        bookRef.current = nextBook;
        renditionRef.current = nextRendition;

        const savedLocator = book.progress?.locator?.trim() || "";
        const canRestoreLocator =
          savedLocator &&
          typeof nextBook.locations?.locationFromCfi === "function" &&
          Number.isFinite(nextBook.locations.locationFromCfi(savedLocator));

        try {
          await nextRendition.display(canRestoreLocator ? savedLocator : undefined);
        } catch {
          await nextRendition.display();
        }

        if (cancelled) {
          return;
        }

        setStatus("ready");

        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];

          if (!entry) {
            return;
          }

          nextRendition.resize?.(
            Math.max(Math.floor(entry.contentRect.width), 1),
            Math.max(Math.floor(entry.contentRect.height), 1)
          );
          clearReflowTimer();
          reflowTimerRef.current = window.setTimeout(() => {
            refreshVisibleWords();
            void rebuildPageIndex();
          }, 220);
        });
        resizeObserver.observe(containerRef.current);
        void rebuildPageIndex();
      } catch (error) {
        if (abortController.signal.aborted || cancelled) {
          return;
        }

        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Book loading failed."
        );
      }
    }

    void loadBook();

    return () => {
      cancelled = true;
      abortController.abort();
      resizeObserver?.disconnect();
      clearProgressTimer();
      clearReflowTimer();
      clearVisibleHighlights();
      onVisibleWordsChange([]);
      pageIndexRef.current = null;
      setIsReflowing(false);
      pageIndexJobRef.current += 1;
      sourceBufferRef.current = null;
      createBookRef.current = null;
      appliedFontScaleRef.current = null;

      renditionRef.current?.destroy?.();
      bookRef.current?.destroy?.();
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [book.id, onVisibleWordsChange]);

  useEffect(() => {
    if (status === "ready") {
      refreshVisibleWords();
    }
  }, [lookup, refreshVisibleWords, status]);

  useEffect(() => {
    if (status !== "ready" || !renditionRef.current) {
      return;
    }

    const normalizedScale = clampFontScale(fontScale);

    if (appliedFontScaleRef.current === normalizedScale) {
      return;
    }

    const rendition = renditionRef.current;
    const currentCfi = rendition.currentLocation?.()?.start?.cfi;

    applyTypography(normalizedScale);
    void (async () => {
      if (currentCfi) {
        try {
          await rendition.display(currentCfi);
        } catch {
          // Keep the current rendered view when CFI display fails unexpectedly.
        }
      }

      refreshVisibleWords();
      await rebuildPageIndex();
    })();
  }, [applyTypography, fontScale, rebuildPageIndex, refreshVisibleWords, status]);

  async function handlePrevPage() {
    if (!renditionRef.current) {
      return;
    }

    await renditionRef.current.prev();
  }

  async function handleNextPage() {
    if (!renditionRef.current) {
      return;
    }

    await renditionRef.current.next();
  }

  function handleDecreaseFont() {
    setFontScale((current) => clampFontScale(current - FONT_SCALE_STEP));
  }

  function handleIncreaseFont() {
    setFontScale((current) => clampFontScale(current + FONT_SCALE_STEP));
  }

  function handleResetFont() {
    setFontScale(DEFAULT_FONT_SCALE);
  }

  return (
    <div className={styles.readerViewport}>
      <div className={styles.readerToolbar}>
        <div>
          <strong>{book.title}</strong>
          <p>
            {book.author} · {pageLabel}
          </p>
        </div>
        <div className={styles.readerToolbarMeta}>
          <div className={styles.fontSizeControls}>
            <button
              className="button"
              disabled={status !== "ready" || fontScale <= MIN_FONT_SCALE}
              onClick={handleDecreaseFont}
              type="button"
            >
              A-
            </button>
            <span>{fontScale}%</span>
            <button
              className="button"
              disabled={status !== "ready" || fontScale >= MAX_FONT_SCALE}
              onClick={handleIncreaseFont}
              type="button"
            >
              A+
            </button>
            <button
              className="button"
              disabled={status !== "ready" || fontScale === DEFAULT_FONT_SCALE}
              onClick={handleResetFont}
              type="button"
            >
              Reset
            </button>
          </div>
          {isReflowing ? <span>Reflowing…</span> : null}
          <span>{progressLabel}</span>
          <button
            className="button"
            disabled={status !== "ready"}
            onClick={() => {
              void handlePrevPage();
            }}
            type="button"
          >
            Previous
          </button>
          <button
            className="button button-primary"
            disabled={status !== "ready"}
            onClick={() => {
              void handleNextPage();
            }}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      {status === "error" ? (
        <div className={styles.readerError}>
          <strong>Cloudflare file load failed</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className={styles.readerFrame}>
        <div
          aria-label={`${book.title} viewport`}
          className={styles.readerMount}
          ref={containerRef}
        />
        {status === "loading" ? (
          <div className={styles.readerLoading}>Loading paginated EPUB…</div>
        ) : null}
      </div>
    </div>
  );
}
