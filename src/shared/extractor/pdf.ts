import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { annotateOutlineRanges, collectAnnotatedNodes, type AnnotatedOutlineNode } from "@shared/extractor/outline";
import { buildPdfPageWarnings, groupPdfTextItems, linesToBlocks, toRenderableTextItems } from "@shared/extractor/pdfText";
import { formatPageRanges, mergePageRanges } from "@shared/extractor/selection";
import type {
  ExtractorDocumentAnalysis,
  ExtractorDocumentSummary,
  ExtractorOutlineNode,
  ExtractorPageRange,
  ExtractorResult,
  ExtractorResultBlock
} from "@shared/types/extractor";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface OutlineNodeWithPage extends ExtractorOutlineNode {
  children: OutlineNodeWithPage[];
  startPage: number | null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export interface ParsedPdfDocument {
  analysis: ExtractorDocumentAnalysis;
  outline: AnnotatedOutlineNode[];
  pdf: PDFDocumentProxy;
}

function flattenOutlineNodes<T extends { children: T[] }>(nodes: T[], target: T[] = []) {
  for (const node of nodes) {
    target.push(node);
    flattenOutlineNodes(node.children, target);
  }

  return target;
}

async function resolvePdfDestinationPage(pdf: PDFDocumentProxy, destination: unknown) {
  let resolvedDestination = destination;

  if (typeof resolvedDestination === "string") {
    resolvedDestination = await pdf.getDestination(resolvedDestination);
  }

  if (!Array.isArray(resolvedDestination) || !resolvedDestination.length) {
    return null;
  }

  const target = resolvedDestination[0];

  if (typeof target === "number") {
    return target + 1;
  }

  if (target && typeof target === "object" && "num" in target) {
    return (await pdf.getPageIndex(target as never)) + 1;
  }

  return null;
}

async function buildPdfOutlineNodes(
  items: Array<{ dest?: unknown; items?: unknown[]; title?: string }>,
  pdf: PDFDocumentProxy,
  ancestry: string[]
): Promise<OutlineNodeWithPage[]> {
  const nodes = await Promise.all(
    items.map(async (item, index) => {
      const id = [...ancestry, `${index}`].join(".");
      const title = normalizeWhitespace(item.title ?? "") || `Section ${index + 1}`;
      const startPage = await resolvePdfDestinationPage(pdf, item.dest);
      const children = Array.isArray(item.items)
        ? await buildPdfOutlineNodes(
            item.items as Array<{ dest?: unknown; items?: unknown[]; title?: string }>,
            pdf,
            [...ancestry, `${index}`]
          )
        : [];

      return {
        id,
        label: title,
        href: startPage ? `page:${startPage}` : null,
        children,
        startPage: startPage ?? children.find((child) => typeof child.startPage === "number")?.startPage ?? null
      };
    })
  );

  return nodes.filter((node) => node.label);
}

export async function analyzePdfDocument(
  buffer: ArrayBuffer,
  documentId: number
): Promise<ParsedPdfDocument> {
  const loadingTask = getDocument({
    data: buffer
  });
  const pdf = await loadingTask.promise;
  const rawOutline = await pdf.getOutline();
  const outlineWithPages = rawOutline
    ? await buildPdfOutlineNodes(rawOutline as Array<{ dest?: unknown; items?: unknown[]; title?: string }>, pdf, ["pdf"])
    : [];
  const pageCount = pdf.numPages;
  const pageById = new Map(
    flattenOutlineNodes(outlineWithPages).map((node) => [node.id, node.startPage] as const)
  );

  const outline = annotateOutlineRanges(
    outlineWithPages,
    (node) => pageById.get(node.id) ?? null,
    pageCount
  );

  return {
    analysis: {
      documentId,
      format: "pdf",
      outline,
      supportsOutline: outline.length > 0,
      supportsPageRanges: true,
      pageCount,
      warnings: outline.length ? [] : ["该 PDF 无目录书签，可改用页码范围提取。"]
    },
    outline,
    pdf
  };
}

async function extractPageBlocks(pdf: PDFDocumentProxy, pageNumber: number) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const textItems = toRenderableTextItems(content.items);

  if (!textItems.length) {
    return {
      blocks: [] as ExtractorResultBlock[],
      textItemCount: 0
    };
  }

  const blocks = linesToBlocks(groupPdfTextItems(textItems));

  return {
    blocks,
    textItemCount: textItems.length
  };
}

export async function extractPdfByPageRanges(
  parsed: ParsedPdfDocument,
  document: ExtractorDocumentSummary,
  ranges: ExtractorPageRange[],
  selectionSummary = formatPageRanges(ranges)
): Promise<ExtractorResult> {
  const normalizedRanges = mergePageRanges(ranges);
  const blocks: ExtractorResultBlock[] = [];
  const textItemCounts: number[] = [];

  for (const range of normalizedRanges) {
    blocks.push({
      type: "section-break",
      label: `页码 ${range.start}-${range.end}`
    });

    for (let pageNumber = range.start; pageNumber <= range.end; pageNumber += 1) {
      const { blocks: pageBlocks, textItemCount } = await extractPageBlocks(parsed.pdf, pageNumber);
      textItemCounts.push(textItemCount);

      if (!pageBlocks.length) {
        continue;
      }

      blocks.push({
        type: "page-break",
        label: `第 ${pageNumber} 页`,
        pageNumber
      });
      blocks.push(...pageBlocks);
    }
  }

  const warnings = buildPdfPageWarnings(textItemCounts);

  return {
    documentId: document.id,
    documentTitle: document.title,
    documentFormat: document.format,
    mode: "pages",
    selectionSummary,
    blocks,
    text: "",
    charCount: 0,
    sourceCount: normalizedRanges.reduce((total, range) => total + (range.end - range.start + 1), 0),
    generatedAt: new Date().toISOString(),
    warnings
  };
}

export async function extractPdfByOutline(
  parsed: ParsedPdfDocument,
  document: ExtractorDocumentSummary,
  selectedIds: string[]
): Promise<ExtractorResult> {
  const selectedNodes = collectAnnotatedNodes(parsed.outline, new Set(selectedIds)).filter(
    (node) => typeof node.start === "number" && typeof node.end === "number"
  );
  const ranges = mergePageRanges(
    selectedNodes.map((node) => ({
      start: node.start as number,
      end: node.end as number
    }))
  );

  return extractPdfByPageRanges(
    parsed,
    document,
    ranges,
    selectedNodes.map((node) => node.label)
  );
}
