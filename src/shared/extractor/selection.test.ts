import { describe, expect, it } from "vitest";

import { parsePageRangeInputs, serializeExtractorResult } from "@shared/extractor/selection";
import type { ExtractorResult } from "@shared/types/extractor";

describe("parsePageRangeInputs", () => {
  it("merges overlapping and adjacent ranges", () => {
    const parsed = parsePageRangeInputs(["20-30", "29-31", "45", "46-48"], 60);

    expect(parsed.errors).toEqual([]);
    expect(parsed.ranges).toEqual([
      { start: 20, end: 31 },
      { start: 45, end: 48 }
    ]);
  });

  it("rejects invalid and out-of-bound ranges", () => {
    const parsed = parsePageRangeInputs(["0-3", "12-9", "61-62", "abc"], 60);

    expect(parsed.ranges).toEqual([]);
    expect(parsed.errors).toHaveLength(4);
  });
});

describe("serializeExtractorResult", () => {
  it("preserves readable separators for headings, sections, lists, and pages", () => {
    const result: ExtractorResult = {
      documentId: 1,
      documentTitle: "Demo",
      documentFormat: "pdf",
      mode: "pages",
      selectionSummary: ["20-21"],
      blocks: [
        { type: "section-break", label: "页码 20-21" },
        { type: "page-break", label: "第 20 页", pageNumber: 20 },
        { type: "heading", level: 2, text: "Intro" },
        { type: "paragraph", text: "First paragraph." },
        { type: "list-item", text: "One item" },
        { type: "quote", text: "Quoted text" }
      ],
      text: "",
      charCount: 0,
      sourceCount: 2,
      generatedAt: "2026-03-13T00:00:00.000Z",
      warnings: []
    };

    expect(serializeExtractorResult(result)).toContain("## 页码 20-21");
    expect(serializeExtractorResult(result)).toContain("--- 第 20 页 ---");
    expect(serializeExtractorResult(result)).toContain("## Intro");
    expect(serializeExtractorResult(result)).toContain("- One item");
    expect(serializeExtractorResult(result)).toContain("> Quoted text");
  });
});
