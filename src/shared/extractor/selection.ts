import type {
  ExtractorOutlineNode,
  ExtractorPageRange,
  ExtractorResult
} from "@shared/types/extractor";

const PAGE_RANGE_PATTERN = /^(\d+)(?:\s*-\s*(\d+))?$/;

export interface ParsedPageRangeInput {
  ranges: ExtractorPageRange[];
  errors: string[];
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function parsePageRangeInputs(inputs: string[], maxPage: number | null): ParsedPageRangeInput {
  const errors: string[] = [];
  const ranges: ExtractorPageRange[] = [];

  inputs.forEach((input, index) => {
    const normalized = input.trim();

    if (!normalized) {
      return;
    }

    const match = normalized.match(PAGE_RANGE_PATTERN);

    if (!match) {
      errors.push(`页码区间 ${index + 1} 格式无效，请使用 12 或 12-18。`);
      return;
    }

    const start = Number.parseInt(match[1], 10);
    const end = Number.parseInt(match[2] ?? match[1], 10);

    if (start <= 0 || end <= 0) {
      errors.push(`页码区间 ${index + 1} 必须从 1 开始。`);
      return;
    }

    if (end < start) {
      errors.push(`页码区间 ${index + 1} 的结束页不能小于起始页。`);
      return;
    }

    if (typeof maxPage === "number" && end > maxPage) {
      errors.push(`页码区间 ${index + 1} 超出总页数 ${maxPage}。`);
      return;
    }

    ranges.push({ start, end });
  });

  return {
    ranges: mergePageRanges(ranges),
    errors
  };
}

export function mergePageRanges(ranges: ExtractorPageRange[]) {
  if (!ranges.length) {
    return [];
  }

  const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: ExtractorPageRange[] = [];

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

export function formatPageRanges(ranges: ExtractorPageRange[]) {
  return ranges.map((range) => (range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`));
}

export function countOutlineNodes(nodes: ExtractorOutlineNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countOutlineNodes(node.children), 0);
}

export function collectOutlineLabels(
  nodes: ExtractorOutlineNode[],
  selectedIds: Set<string>,
  accumulator: string[] = []
) {
  for (const node of nodes) {
    if (selectedIds.has(node.id)) {
      accumulator.push(node.label);
    }

    collectOutlineLabels(node.children, selectedIds, accumulator);
  }

  return accumulator;
}

export function serializeExtractorResult(result: ExtractorResult) {
  const lines: string[] = [];

  for (const block of result.blocks) {
    if (block.type === "section-break") {
      if (lines.length) {
        lines.push("");
      }

      lines.push(`## ${normalizeWhitespace(block.label)}`);
      lines.push("");
      continue;
    }

    if (block.type === "page-break") {
      if (lines.length) {
        lines.push("");
      }

      lines.push(`--- 第 ${block.pageNumber} 页 ---`);
      lines.push("");
      continue;
    }

    if (block.type === "heading") {
      if (lines.length && lines[lines.length - 1] !== "") {
        lines.push("");
      }

      lines.push(`${"#".repeat(Math.min(Math.max(block.level, 1), 6))} ${normalizeWhitespace(block.text)}`);
      lines.push("");
      continue;
    }

    if (block.type === "list-item") {
      lines.push(`- ${normalizeWhitespace(block.text)}`);
      continue;
    }

    if (block.type === "quote") {
      lines.push(`> ${normalizeWhitespace(block.text)}`);
      continue;
    }

    lines.push(normalizeWhitespace(block.text));
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
