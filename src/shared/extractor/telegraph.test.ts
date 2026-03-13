import { describe, expect, it } from "vitest";

import {
  buildTelegraphIndexNodes,
  buildTelegraphPartNodes,
  splitTelegraphBlocks
} from "@shared/extractor/telegraph";
import type { ExtractorTelegraphPartPage } from "@shared/types/extractor";

describe("buildTelegraphPartNodes", () => {
  it("serializes mixed text and image blocks in order", () => {
    const nodes = buildTelegraphPartNodes(
      [
        { type: "section-break", label: "Chapter One" },
        { type: "heading", level: 1, text: "Chapter One" },
        {
          type: "image",
          assetId: "epub:OPS/images/fruit.svg",
          alt: "Fruit plate",
          caption: "Fruit plate",
          mimeType: "image/svg+xml"
        },
        { type: "paragraph", text: "First paragraph." }
      ],
      new Map([["epub:OPS/images/fruit.svg", "https://example.com/fruit.svg"]])
    );

    expect(JSON.stringify(nodes)).toContain("Chapter One");
    expect(JSON.stringify(nodes)).toContain("https://example.com/fruit.svg");
    expect(JSON.stringify(nodes)).toContain("First paragraph.");
  });
});

describe("splitTelegraphBlocks", () => {
  it("splits long block sequences across parts without dropping order", () => {
    const blocks = Array.from({ length: 10 }, (_, index) => ({
      type: "paragraph" as const,
      text: `Paragraph ${index + 1} `.repeat(40)
    }));
    const parts = splitTelegraphBlocks(blocks, new Map(), 700);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.flat()).toEqual(blocks);
  });
});

describe("buildTelegraphIndexNodes", () => {
  it("builds an index node list for multipage exports", () => {
    const partPages: ExtractorTelegraphPartPage[] = [
      {
        partNumber: 1,
        path: "doc-part-1",
        title: "Doc · Part 1",
        url: "https://telegra.ph/doc-part-1"
      },
      {
        partNumber: 2,
        path: "doc-part-2",
        title: "Doc · Part 2",
        url: "https://telegra.ph/doc-part-2"
      }
    ];
    const nodes = buildTelegraphIndexNodes("Doc", ["Chapter One"], partPages);

    expect(JSON.stringify(nodes)).toContain("https://telegra.ph/doc-part-1");
    expect(JSON.stringify(nodes)).toContain("https://telegra.ph/doc-part-2");
    expect(JSON.stringify(nodes)).toContain("Selection: Chapter One");
  });
});
