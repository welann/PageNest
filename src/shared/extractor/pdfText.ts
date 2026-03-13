import type { TextItem } from "pdfjs-dist/types/src/display/api";

import type { ExtractorResultBlock } from "@shared/types/extractor";

interface PdfLine {
  height: number;
  text: string;
  y: number;
}

function getTextItemHeight(item: TextItem) {
  const transformHeight = Array.isArray(item.transform) ? Math.abs(item.transform[3] ?? 0) : 0;
  return Math.max(Math.abs(item.height ?? 0), transformHeight);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function joinSegments(left: string, right: string) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  const previousChar = left[left.length - 1];
  const nextChar = right[0];
  const shouldSkipSpace = /[\s(-/]$/.test(previousChar) || /^[\s),.;:!?]/.test(nextChar);

  return shouldSkipSpace ? `${left}${right}` : `${left} ${right}`;
}

export function toRenderableTextItems(items: unknown[]): TextItem[] {
  return items.filter((item): item is TextItem => {
    if (!item || typeof item !== "object" || !("str" in item)) {
      return false;
    }

    return normalizeWhitespace(String(item.str)).length > 0;
  });
}

export function groupPdfTextItems(items: TextItem[]) {
  const sorted = [...items].sort((left, right) => {
    const leftY = Number(left.transform?.[5] ?? 0);
    const rightY = Number(right.transform?.[5] ?? 0);

    if (Math.abs(rightY - leftY) > 1.2) {
      return rightY - leftY;
    }

    return Number(left.transform?.[4] ?? 0) - Number(right.transform?.[4] ?? 0);
  });

  const lines: PdfLine[] = [];

  for (const item of sorted) {
    const text = normalizeWhitespace(item.str);

    if (!text) {
      continue;
    }

    const y = Number(item.transform?.[5] ?? 0);
    const height = getTextItemHeight(item);
    const previous = lines[lines.length - 1];

    if (!previous || Math.abs(previous.y - y) > Math.max(2.4, previous.height * 0.45, height * 0.45)) {
      lines.push({
        height,
        text,
        y
      });
      continue;
    }

    previous.text = joinSegments(previous.text, text);
    previous.height = Math.max(previous.height, height);
  }

  return lines;
}

export function linesToBlocks(lines: PdfLine[]) {
  if (!lines.length) {
    return [];
  }

  const medianHeight = [...lines]
    .map((line) => line.height)
    .sort((left, right) => left - right)[Math.floor(lines.length / 2)] ?? 0;
  const blocks: ExtractorResultBlock[] = [];
  let paragraphBuffer: string[] = [];
  let previousY: number | null = null;

  const flushParagraph = () => {
    const text = normalizeWhitespace(paragraphBuffer.join(" "));

    if (text) {
      blocks.push({
        type: /^([-\u2022*]|\d+\.)\s/.test(text) ? "list-item" : "paragraph",
        text
      });
    }

    paragraphBuffer = [];
  };

  for (const line of lines) {
    const lineText = normalizeWhitespace(line.text);

    if (!lineText) {
      continue;
    }

    const gap = previousY === null ? 0 : Math.abs(previousY - line.y);
    const looksLikeHeading =
      line.height >= Math.max(medianHeight * 1.35, medianHeight + 2) &&
      lineText.length <= 120 &&
      !/[.!?;:]$/.test(lineText);

    if (looksLikeHeading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: line.height >= medianHeight * 1.75 ? 2 : 3,
        text: lineText
      });
      previousY = line.y;
      continue;
    }

    if (gap > Math.max(line.height * 1.35, 16)) {
      flushParagraph();
    }

    paragraphBuffer.push(lineText);
    previousY = line.y;
  }

  flushParagraph();

  return blocks;
}

export function buildPdfPageWarnings(
  textItemCounts: number[],
  imagePresence: boolean[] = textItemCounts.map(() => false)
) {
  const emptyPages = textItemCounts.filter((count, index) => count === 0 && !imagePresence[index]).length;

  if (!emptyPages) {
    return [];
  }

  if (emptyPages === textItemCounts.length) {
    return ["当前 PDF 范围没有可提取文本，可能是扫描件；v1 暂不支持 OCR。"];
  }

  return [`有 ${emptyPages} 页没有可提取文本，已在结果中跳过这些空白/扫描页。`];
}
