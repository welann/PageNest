import { describe, expect, it } from "vitest";

import { buildPdfPageWarnings, groupPdfTextItems } from "@shared/extractor/pdfText";
import { hasPdfImageOps } from "@shared/extractor/pdfOps";

describe("groupPdfTextItems", () => {
  it("groups nearby text items into readable lines", () => {
    const lines = groupPdfTextItems([
      {
        str: "Hello",
        transform: [1, 0, 0, 12, 10, 100],
        width: 30,
        height: 12,
        hasEOL: false,
        dir: "ltr",
        fontName: "f1"
      },
      {
        str: "world",
        transform: [1, 0, 0, 12, 48, 100],
        width: 30,
        height: 12,
        hasEOL: false,
        dir: "ltr",
        fontName: "f1"
      },
      {
        str: "Next line",
        transform: [1, 0, 0, 12, 10, 80],
        width: 40,
        height: 12,
        hasEOL: false,
        dir: "ltr",
        fontName: "f1"
      }
    ]);

    expect(lines).toEqual([
      expect.objectContaining({ text: "Hello world" }),
      expect.objectContaining({ text: "Next line" })
    ]);
  });
});

describe("buildPdfPageWarnings", () => {
  it("flags likely scanned ranges when every page is empty", () => {
    expect(buildPdfPageWarnings([0, 0, 0])).toEqual([
      "当前 PDF 范围没有可提取文本，可能是扫描件；v1 暂不支持 OCR。"
    ]);
  });

  it("flags partial empty-page ranges without failing the whole extraction", () => {
    expect(buildPdfPageWarnings([12, 0, 5])).toEqual([
      "有 1 页没有可提取文本，已在结果中跳过这些空白/扫描页。"
    ]);
  });

  it("does not warn when empty pages are exported as image pages", () => {
    expect(buildPdfPageWarnings([0, 0], [true, true])).toEqual([]);
  });
});

describe("hasPdfImageOps", () => {
  it("detects image paint operators in a PDF page operator list", () => {
    expect(hasPdfImageOps([10, 85, 11])).toBe(true);
    expect(hasPdfImageOps([10, 11])).toBe(false);
  });
});
