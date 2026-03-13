import JSZip from "jszip";

import type { ExtractorOutlineNode, ExtractorResultBlock } from "@shared/types/extractor";

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

interface DomElementLike {
  childNodes?: ArrayLike<unknown>;
  getAttribute: (name: string) => string | null;
  getElementsByTagName: (name: string) => ArrayLike<unknown>;
  tagName: string;
  textContent: string | null;
}

export interface ParsedEpubMetadata {
  title: string;
  author: string;
  language: string;
}

export interface ParsedEpubSection {
  blocks: ExtractorResultBlock[];
  href: string;
  id: string;
  markup: string;
  order: number;
  text: string;
  title: string;
}

export interface ParsedEpubArchive {
  metadata: ParsedEpubMetadata;
  outline: ExtractorOutlineNode[];
  sections: ParsedEpubSection[];
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([a-f\d]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    );
}

function normalizeWhitespace(text: string) {
  return decodeXmlEntities(text).replace(/\s+/g, " ").trim();
}

function extractTagValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? normalizeWhitespace(match[1]) : "";
}

function extractAttribute(tagText: string, attributeName: string) {
  const match = tagText.match(
    new RegExp(`${attributeName}\\s*=\\s*(\"([^\"]*)\"|'([^']*)')`, "i")
  );

  if (!match) {
    return "";
  }

  return decodeXmlEntities(match[2] ?? match[3] ?? "");
}

function resolveRelativePath(baseFilePath: string, relativePath: string) {
  const segments = baseFilePath.split("/");
  segments.pop();

  for (const segment of relativePath.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
}

function normalizeEpubHref(href: string) {
  return decodeURIComponent(href).split("#")[0].replace(/^\.\//, "");
}

function stripMarkup(markup: string) {
  return normalizeWhitespace(
    markup
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br[^>]*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|blockquote|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function parseManifest(opfText: string) {
  const manifest = new Map<string, ManifestItem>();
  const manifestPattern = /<item\b([\s\S]*?)\/?>/gi;

  for (const match of opfText.matchAll(manifestPattern)) {
    const tagText = match[0];
    const id = extractAttribute(tagText, "id");
    const href = extractAttribute(tagText, "href");
    const mediaType = extractAttribute(tagText, "media-type");
    const properties = extractAttribute(tagText, "properties");

    if (!id || !href || !mediaType) {
      continue;
    }

    manifest.set(id, {
      id,
      href,
      mediaType,
      properties
    });
  }

  return manifest;
}

function parseSpine(opfText: string) {
  return Array.from(opfText.matchAll(/<itemref\b[^>]*idref="([^"]+)"[^>]*\/?>/gi)).map(
    (match) => match[1]
  );
}

async function loadRequiredTextFile(zip: JSZip, filePath: string) {
  const file = zip.file(filePath);

  if (!file) {
    throw new Error(`EPUB archive is missing ${filePath}.`);
  }

  return file.async("string");
}

function getDomParser() {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  return new DOMParser();
}

function getChildElements(element: { childNodes?: ArrayLike<unknown> }) {
  return Array.from(element.childNodes ?? []).filter((child): child is DomElementLike => {
    return Boolean(
      child &&
        typeof child === "object" &&
        "nodeType" in child &&
        Number((child as { nodeType?: number }).nodeType) === 1
    );
  });
}

function findFirstDescendant(root: { getElementsByTagName: (name: string) => ArrayLike<unknown> }, tagNames: string[]) {
  for (const tagName of tagNames) {
    const match = Array.from(root.getElementsByTagName(tagName))[0];

    if (match) {
      return match as DomElementLike;
    }
  }

  return null;
}

function extractBlocksFromMarkup(markup: string): ExtractorResultBlock[] {
  const parser = getDomParser();

  if (!parser) {
    const text = stripMarkup(markup);
    return text ? [{ type: "paragraph", text }] : [];
  }

  const document = parser.parseFromString(markup, "text/html");
  const root =
    ((document as Document & { body?: unknown }).body as DomElementLike | undefined)
    ?? (document.getElementsByTagName("body")[0] as DomElementLike | undefined)
    ?? (document.documentElement as unknown as DomElementLike);
  const blocks: ExtractorResultBlock[] = [];

  const pushTextBlock = (type: "paragraph" | "list-item" | "quote", text: string) => {
    const normalized = normalizeWhitespace(text);

    if (!normalized) {
      return;
    }

    blocks.push({ type, text: normalized });
  };

  const visit = (element: DomElementLike) => {
    const tagName = element.tagName.toLowerCase();
    const text = normalizeWhitespace(element.textContent ?? "");

    if (!text) {
      return;
    }

    if (/^h[1-6]$/.test(tagName)) {
      blocks.push({
        type: "heading",
        level: Number.parseInt(tagName.slice(1), 10),
        text
      });
      return;
    }

    if (tagName === "p" || tagName === "pre") {
      pushTextBlock("paragraph", text);
      return;
    }

    if (tagName === "blockquote") {
      pushTextBlock("quote", text);
      return;
    }

    if (tagName === "li") {
      pushTextBlock("list-item", text);
      return;
    }

    if (tagName === "img" || tagName === "svg") {
      return;
    }

    const childElements = getChildElements(element);

    if (!childElements.length) {
      pushTextBlock("paragraph", text);
      return;
    }

    childElements.forEach(visit);
  };

  getChildElements(root).forEach(visit);

  if (!blocks.length) {
    const fallbackText = normalizeWhitespace(root.textContent ?? "");

    if (fallbackText) {
      blocks.push({
        type: "paragraph",
        text: fallbackText
      });
    }
  }

  return blocks;
}

function parseNavOutline(markup: string, navPath: string): ExtractorOutlineNode[] {
  const parser = getDomParser();

  if (!parser) {
    return [];
  }

  const document = parser.parseFromString(markup, "text/html");
  const navElements = Array.from(document.getElementsByTagName("nav")) as DomElementLike[];
  const tocNav = navElements.find((element) => {
    const type = element.getAttribute("epub:type") ?? element.getAttribute("type") ?? element.getAttribute("role");
    return type === "toc" || type === "doc-toc";
  }) ?? navElements[0];

  if (!tocNav) {
    return [];
  }

  const rootList = findFirstDescendant(tocNav, ["ol", "ul"]);

  if (!rootList) {
    return [];
  }

  const buildNodes = (list: DomElementLike, ancestry: string[]): ExtractorOutlineNode[] =>
    getChildElements(list)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child, index) => {
        const directLabelElement = getChildElements(child).find((element) => {
          const tagName = element.tagName.toLowerCase();
          return tagName === "a" || tagName === "span";
        });
        const nestedList = getChildElements(child).find((element) => {
          const tagName = element.tagName.toLowerCase();
          return tagName === "ol" || tagName === "ul";
        });
        const id = [...ancestry, `${index}`].join(".");
        const href = directLabelElement?.getAttribute("href");

        return {
          id,
          label: normalizeWhitespace(directLabelElement?.textContent ?? child.textContent ?? `Section ${index + 1}`),
          href: href ? normalizeEpubHref(resolveRelativePath(navPath, href)) : null,
          children: nestedList ? buildNodes(nestedList, [...ancestry, `${index}`]) : []
        };
      });

  return buildNodes(rootList, ["toc"]);
}

function parseNcxOutline(markup: string, ncxPath: string): ExtractorOutlineNode[] {
  const parser = getDomParser();

  if (!parser) {
    return [];
  }

  const document = parser.parseFromString(markup, "application/xml");

  const buildNode = (navPoint: DomElementLike, ancestry: string[]): ExtractorOutlineNode => {
    const playOrder = navPoint.getAttribute("playOrder") ?? ancestry.join(".");
    const navLabel = navPoint.getElementsByTagName("navLabel")[0] as DomElementLike | undefined;
    const textNode =
      (navLabel?.getElementsByTagName("text")[0] as DomElementLike | undefined)
      ?? (navPoint.getElementsByTagName("text")[0] as DomElementLike | undefined);
    const contentNode = navPoint.getElementsByTagName("content")[0] as DomElementLike | undefined;
    const label = normalizeWhitespace(
      textNode?.textContent ?? "Untitled section"
    );
    const src = contentNode?.getAttribute("src");

    return {
      id: [...ancestry, playOrder].join("."),
      label,
      href: src ? normalizeEpubHref(resolveRelativePath(ncxPath, src)) : null,
      children: getChildElements(navPoint)
        .filter((child) => child.tagName.toLowerCase() === "navpoint")
        .map((child, index) => buildNode(child, [...ancestry, `${index}`]))
    };
  };

  return Array.from(document.getElementsByTagName("navPoint"))
    .filter((element) => element.parentElement?.tagName !== "navPoint")
    .map((navPoint, index) => buildNode(navPoint, ["ncx", `${index}`]));
}

function buildFallbackOutline(sections: ParsedEpubSection[]): ExtractorOutlineNode[] {
  return sections.map((section) => ({
    id: `section-${section.order}`,
    label: section.title,
    href: normalizeEpubHref(section.href),
    children: []
  }));
}

export async function parseEpubArchive(
  data: ArrayBuffer | Uint8Array
): Promise<ParsedEpubArchive> {
  const zip = await JSZip.loadAsync(data);
  const containerXml = await loadRequiredTextFile(zip, "META-INF/container.xml");
  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/i);

  if (!opfPathMatch) {
    throw new Error("EPUB container.xml does not declare an OPF package path.");
  }

  const opfPath = decodeXmlEntities(opfPathMatch[1]);
  const opfText = await loadRequiredTextFile(zip, opfPath);
  const manifest = parseManifest(opfText);
  const spineIds = parseSpine(opfText);

  const sections: ParsedEpubSection[] = [];

  for (const [order, spineId] of spineIds.entries()) {
    const item = manifest.get(spineId);

    if (!item || !/(application\/xhtml\+xml|text\/html)/i.test(item.mediaType)) {
      continue;
    }

    const chapterPath = resolveRelativePath(opfPath, item.href);
    const chapterMarkup = await loadRequiredTextFile(zip, chapterPath);
    const text = stripMarkup(chapterMarkup);

    if (!text) {
      continue;
    }

    const blocks = extractBlocksFromMarkup(chapterMarkup);
    const title =
      blocks.find((block) => block.type === "heading")?.text ??
      extractTagValue(chapterMarkup, "title") ??
      `Section ${order + 1}`;

    sections.push({
      blocks,
      href: chapterPath,
      id: item.id,
      markup: chapterMarkup,
      order,
      text,
      title
    });
  }

  if (!sections.length) {
    throw new Error("EPUB archive does not contain readable XHTML spine items.");
  }

  let outline: ExtractorOutlineNode[] = [];
  const navItem = Array.from(manifest.values()).find((item) =>
    item.properties.split(/\s+/).includes("nav")
  );

  if (navItem) {
    const navPath = resolveRelativePath(opfPath, navItem.href);
    const navMarkup = await loadRequiredTextFile(zip, navPath);
    outline = parseNavOutline(navMarkup, navPath);
  }

  if (!outline.length) {
    const ncxItem = Array.from(manifest.values()).find(
      (item) =>
        item.mediaType === "application/x-dtbncx+xml" || item.href.toLowerCase().endsWith(".ncx")
    );

    if (ncxItem) {
      const ncxPath = resolveRelativePath(opfPath, ncxItem.href);
      const ncxMarkup = await loadRequiredTextFile(zip, ncxPath);
      outline = parseNcxOutline(ncxMarkup, ncxPath);
    }
  }

  if (!outline.length) {
    outline = buildFallbackOutline(sections);
  }

  const title = extractTagValue(opfText, "dc:title");
  const author = extractTagValue(opfText, "dc:creator");
  const language = extractTagValue(opfText, "dc:language");

  return {
    metadata: {
      title: title || "Untitled EPUB",
      author: author || "Unknown author",
      language: language || "en"
    },
    outline,
    sections
  };
}

export function normalizeEpubSectionHref(href: string) {
  return normalizeEpubHref(href);
}
