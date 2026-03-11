import JSZip from "jszip";

import { ReaderHttpError } from "./reader-data";

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

export interface ParsedEpubMetadata {
  title: string;
  author: string;
  language: string;
}

export interface ParsedEpubSection {
  href: string;
  text: string;
}

export interface ParsedEpubArchive {
  metadata: ParsedEpubMetadata;
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

function extractTagValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXmlEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

function extractAttribute(tagText: string, attributeName: string) {
  const match = tagText.match(
    new RegExp(`${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")
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

function stripMarkup(markup: string) {
  return decodeXmlEntities(
    markup
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br[^>]*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|blockquote|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseManifest(opfText: string) {
  const manifest = new Map<string, ManifestItem>();
  const manifestPattern = /<item\b([\s\S]*?)\/?>/gi;

  for (const match of opfText.matchAll(manifestPattern)) {
    const tagText = match[0];
    const id = extractAttribute(tagText, "id");
    const href = extractAttribute(tagText, "href");
    const mediaType = extractAttribute(tagText, "media-type");

    if (!id || !href || !mediaType) {
      continue;
    }

    manifest.set(id, {
      id,
      href,
      mediaType
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
    throw new ReaderHttpError(`EPUB archive is missing ${filePath}.`, 400);
  }

  return file.async("string");
}

export async function parseEpubArchive(
  data: ArrayBuffer | Uint8Array
): Promise<ParsedEpubArchive> {
  const zip = await JSZip.loadAsync(data);
  const containerXml = await loadRequiredTextFile(zip, "META-INF/container.xml");
  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/i);

  if (!opfPathMatch) {
    throw new ReaderHttpError("EPUB container.xml does not declare an OPF package path.", 400);
  }

  const opfPath = decodeXmlEntities(opfPathMatch[1]);
  const opfText = await loadRequiredTextFile(zip, opfPath);
  const manifest = parseManifest(opfText);
  const spineIds = parseSpine(opfText);

  const sections: ParsedEpubSection[] = [];

  for (const spineId of spineIds) {
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

    sections.push({
      href: item.href,
      text
    });
  }

  if (sections.length === 0) {
    throw new ReaderHttpError("EPUB archive does not contain readable XHTML spine items.", 400);
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
    sections
  };
}
