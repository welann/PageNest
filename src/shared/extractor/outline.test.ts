import { describe, expect, it } from "vitest";

import { annotateOutlineRanges } from "@shared/extractor/outline";
import type { ExtractorOutlineNode } from "@shared/types/extractor";

describe("annotateOutlineRanges", () => {
  it("expands parent ranges until the next sibling after the subtree", () => {
    const nodes: ExtractorOutlineNode[] = [
      {
        id: "parent",
        label: "Parent",
        href: "one",
        children: [
          {
            id: "child-1",
            label: "Child 1",
            href: "one",
            children: []
          },
          {
            id: "child-2",
            label: "Child 2",
            href: "five",
            children: []
          }
        ]
      },
      {
        id: "next",
        label: "Next",
        href: "ten",
        children: []
      }
    ];
    const startById = new Map([
      ["parent", 1],
      ["child-1", 1],
      ["child-2", 5],
      ["next", 10]
    ]);

    const annotated = annotateOutlineRanges(nodes, (node) => startById.get(node.id) ?? null, 12);

    expect(annotated[0].start).toBe(1);
    expect(annotated[0].end).toBe(9);
    expect(annotated[0].children[0].end).toBe(4);
    expect(annotated[0].children[1].end).toBe(9);
    expect(annotated[1].end).toBe(12);
  });
});
