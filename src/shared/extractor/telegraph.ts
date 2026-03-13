import type {
  ExtractorResultBlock,
  ExtractorTelegraphPartPage
} from "@shared/types/extractor";

export interface TelegraphElementNode {
  attrs?: Record<string, string>;
  children?: TelegraphNode[];
  tag: string;
}

export type TelegraphNode = TelegraphElementNode | string;

export const TELEGRAPH_CONTENT_BYTE_BUDGET = 48 * 1024;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toTextNode(value: string) {
  return normalizeWhitespace(value);
}

function paragraph(children: TelegraphNode[]): TelegraphElementNode {
  return {
    tag: "p",
    children
  };
}

function sectionLabelNode(label: string) {
  return paragraph([
    {
      tag: "strong",
      children: [toTextNode(label)]
    }
  ]);
}

export function summarizeExtractorSelection(selectionSummary: string[]) {
  const summary = selectionSummary
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .slice(0, 3)
    .join(" / ");

  return summary || "Selected Content";
}

export function buildTelegraphPartTitle(
  documentTitle: string,
  selectionSummary: string[],
  partNumber?: number
) {
  const summary = summarizeExtractorSelection(selectionSummary);

  if (typeof partNumber === "number") {
    return `${documentTitle} · ${summary} · Part ${partNumber}`;
  }

  return `${documentTitle} · ${summary}`;
}

function buildDirectoryBacklinkNode(indexPageUrl: string) {
  return paragraph([
    "Back to ",
    {
      tag: "a",
      attrs: {
        href: indexPageUrl
      },
      children: ["Index"]
    }
  ]);
}

export function blockToTelegraphNodes(
  block: ExtractorResultBlock,
  assetUrls: Map<string, string>
) {
  if (block.type === "section-break") {
    return [
      {
        tag: "hr"
      },
      sectionLabelNode(block.label)
    ] satisfies TelegraphNode[];
  }

  if (block.type === "page-break") {
    return [
      {
        tag: "hr"
      },
      sectionLabelNode(`第 ${block.pageNumber} 页`)
    ] satisfies TelegraphNode[];
  }

  if (block.type === "heading") {
    return [
      {
        tag: block.level <= 2 ? "h3" : "h4",
        children: [toTextNode(block.text)]
      }
    ] satisfies TelegraphNode[];
  }

  if (block.type === "paragraph") {
    return [paragraph([toTextNode(block.text)])] satisfies TelegraphNode[];
  }

  if (block.type === "list-item") {
    return [
      {
        tag: "ul",
        children: [
          {
            tag: "li",
            children: [toTextNode(block.text)]
          }
        ]
      }
    ] satisfies TelegraphNode[];
  }

  if (block.type === "quote") {
    return [
      {
        tag: "blockquote",
        children: [toTextNode(block.text)]
      }
    ] satisfies TelegraphNode[];
  }

  const assetUrl = assetUrls.get(block.assetId);

  if (!assetUrl) {
    return [
      paragraph([toTextNode(block.caption || block.alt || block.sourceLabel || "Image unavailable")])
    ] satisfies TelegraphNode[];
  }

  return [
    {
      tag: "figure",
      children: [
        {
          tag: "img",
          attrs: {
            src: assetUrl
          }
        },
        ...(block.caption
          ? [
              {
                tag: "figcaption",
                children: [toTextNode(block.caption)]
              } satisfies TelegraphElementNode
            ]
          : [])
      ]
    }
  ] satisfies TelegraphNode[];
}

export function buildTelegraphPartNodes(
  blocks: ExtractorResultBlock[],
  assetUrls: Map<string, string>,
  indexPageUrl?: string | null
) {
  const nodes: TelegraphNode[] = [];

  if (indexPageUrl) {
    nodes.push(buildDirectoryBacklinkNode(indexPageUrl));
  }

  for (const block of blocks) {
    nodes.push(...blockToTelegraphNodes(block, assetUrls));
  }

  return nodes;
}

export function estimateTelegraphContentBytes(nodes: TelegraphNode[]) {
  return new TextEncoder().encode(JSON.stringify(nodes)).length;
}

export function splitTelegraphBlocks(
  blocks: ExtractorResultBlock[],
  assetUrls: Map<string, string>,
  byteBudget = TELEGRAPH_CONTENT_BYTE_BUDGET
) {
  if (!blocks.length) {
    return [];
  }

  const parts: ExtractorResultBlock[][] = [];
  let current: ExtractorResultBlock[] = [];

  const flushCurrent = () => {
    if (!current.length) {
      return;
    }

    parts.push(current);
    current = [];
  };

  for (const block of blocks) {
    const next = [...current, block];
    const bytes = estimateTelegraphContentBytes(buildTelegraphPartNodes(next, assetUrls));

    if (current.length && bytes > byteBudget) {
      flushCurrent();
      current = [block];
      continue;
    }

    current = next;
  }

  flushCurrent();

  return parts;
}

export function buildTelegraphIndexNodes(
  documentTitle: string,
  selectionSummary: string[],
  partPages: ExtractorTelegraphPartPage[]
) {
  const nodes: TelegraphNode[] = [
    {
      tag: "h3",
      children: [documentTitle]
    }
  ];

  const summary = summarizeExtractorSelection(selectionSummary);

  nodes.push(paragraph([`Selection: ${summary}`]));
  nodes.push({
    tag: "ol",
    children: partPages.map((part) => ({
      tag: "li",
      children: [
        {
          tag: "a",
          attrs: {
            href: part.url
          },
          children: [part.title]
        }
      ]
    }))
  });

  return nodes;
}
