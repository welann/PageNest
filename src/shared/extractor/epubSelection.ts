import { annotateOutlineRanges, collectAnnotatedNodes, type AnnotatedOutlineNode } from "@shared/extractor/outline";
import { normalizeEpubSectionHref, type ParsedEpubArchive } from "@shared/extractor/epubArchive";
import type {
  ExtractorDocumentAnalysis,
  ExtractorDocumentSummary,
  ExtractorResult
} from "@shared/types/extractor";

interface EpubSectionRange {
  end: number;
  start: number;
}

export interface ParsedEpubDocument {
  analysis: ExtractorDocumentAnalysis;
  archive: ParsedEpubArchive;
  outline: AnnotatedOutlineNode[];
}

function mergeSectionRanges(ranges: EpubSectionRange[]) {
  if (!ranges.length) {
    return [];
  }

  const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: EpubSectionRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];

    if (!previous || range.start > previous.end + 1) {
      merged.push({ ...range });
      continue;
    }

    previous.end = Math.max(previous.end, range.end);
  }

  return merged;
}

function getSelectedOutlineNodes(parsed: ParsedEpubDocument, selectedIds: string[]) {
  return collectAnnotatedNodes(parsed.outline, new Set(selectedIds)).filter(
    (node) => typeof node.start === "number" && typeof node.end === "number"
  );
}

export function getEpubSectionsByOutline(parsed: ParsedEpubDocument, selectedIds: string[]) {
  const selectedNodes = getSelectedOutlineNodes(parsed, selectedIds);
  const ranges = mergeSectionRanges(
    selectedNodes.map((node) => ({
      start: node.start as number,
      end: node.end as number
    }))
  );

  const sections = ranges.flatMap((range) =>
    parsed.archive.sections.filter(
      (section) => section.order >= range.start && section.order <= range.end
    )
  );

  return {
    ranges,
    sections,
    selectedNodes
  };
}

export function analyzeEpubArchive(
  archive: ParsedEpubArchive,
  documentId: number
): ParsedEpubDocument {
  const orderByHref = new Map(
    archive.sections.map((section) => [normalizeEpubSectionHref(section.href), section.order])
  );
  const outline = annotateOutlineRanges(
    archive.outline,
    (node) => (node.href ? orderByHref.get(normalizeEpubSectionHref(node.href)) ?? null : null),
    archive.sections[archive.sections.length - 1]?.order ?? 0
  );

  return {
    analysis: {
      documentId,
      format: "epub",
      outline,
      supportsOutline: outline.length > 0,
      supportsPageRanges: false,
      pageCount: null,
      warnings: ["EPUB 是可重排内容，当前版本只支持按目录提取，不提供稳定页码范围。"]
    },
    archive,
    outline
  };
}

export function extractEpubByOutline(
  parsed: ParsedEpubDocument,
  document: ExtractorDocumentSummary,
  selectedIds: string[]
): ExtractorResult {
  const { ranges, sections, selectedNodes } = getEpubSectionsByOutline(parsed, selectedIds);
  const blocks = [];

  for (const section of sections) {
    blocks.push({
      type: "section-break" as const,
      label: section.title
    });
    blocks.push(...section.blocks);
  }

  return {
    documentId: document.id,
    documentTitle: document.title,
    documentFormat: document.format,
    mode: "outline",
    selectionSummary: selectedNodes.map((node) => node.label),
    sourceRefs: sections.map((section) => normalizeEpubSectionHref(section.href)),
    blocks,
    text: "",
    charCount: 0,
    sourceCount: ranges.reduce((total, range) => total + (range.end - range.start + 1), 0),
    generatedAt: new Date().toISOString(),
    warnings: blocks.length ? [] : ["当前目录范围没有可提取正文。"]
  };
}
