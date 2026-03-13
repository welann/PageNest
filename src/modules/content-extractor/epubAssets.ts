import {
  buildEpubAssetId,
  resolveEpubRelativeHref,
  type ParsedEpubAsset
} from "@shared/extractor/epubArchive";

const INLINE_EPUB_ASSET_PREFIX = "epub:inline:";
const EPUB_ASSET_PREFIX = "epub:";

function encodeBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...slice);
  }

  return btoa(binary);
}

function toDataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${encodeBase64(bytes)}`;
}

function encodeUtf8(text: string) {
  return new TextEncoder().encode(text);
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function getAssetBasePath(assetId: string) {
  if (assetId.startsWith(INLINE_EPUB_ASSET_PREFIX)) {
    return assetId.slice(INLINE_EPUB_ASSET_PREFIX.length).split("#")[0];
  }

  if (assetId.startsWith(EPUB_ASSET_PREFIX)) {
    return assetId.slice(EPUB_ASSET_PREFIX.length);
  }

  return null;
}

function resolveNestedAssetId(assetId: string, href: string) {
  if (!href || /^(data:|blob:|https?:|#)/i.test(href)) {
    return null;
  }

  const basePath = getAssetBasePath(assetId);

  if (!basePath) {
    return null;
  }

  return buildEpubAssetId(resolveEpubRelativeHref(basePath, href));
}

function rewriteSvgText(
  assetId: string,
  svgText: string,
  assets: Record<string, ParsedEpubAsset>,
  visited: Set<string>
): string {
  const hrefPattern = /(<image\b[^>]*?\s(?:xlink:href|href)=["'])([^"']+)(["'][^>]*>)/gi;

  return svgText.replace(hrefPattern, (fullMatch, prefix: string, href: string, suffix: string) => {
    const nestedAssetId = resolveNestedAssetId(assetId, href);

    if (!nestedAssetId) {
      return fullMatch;
    }

    const nestedAsset = assets[nestedAssetId];

    if (!nestedAsset) {
      return fullMatch;
    }

    const dataUrl = buildResolvedEpubAssetDataUrl(nestedAssetId, assets, visited);

    if (!dataUrl) {
      return fullMatch;
    }

    return `${prefix}${dataUrl}${suffix}`;
  });
}

export function buildResolvedEpubAssetBytes(
  assetId: string,
  assets: Record<string, ParsedEpubAsset>,
  visited = new Set<string>()
): Uint8Array | null {
  if (visited.has(assetId)) {
    return null;
  }

  const asset = assets[assetId];

  if (!asset) {
    return null;
  }

  if (asset.mimeType !== "image/svg+xml") {
    return asset.data;
  }

  visited.add(assetId);

  const resolvedSvg = rewriteSvgText(assetId, decodeUtf8(asset.data), assets, visited);

  visited.delete(assetId);
  return encodeUtf8(resolvedSvg);
}

export function buildResolvedEpubAssetDataUrl(
  assetId: string,
  assets: Record<string, ParsedEpubAsset>,
  visited = new Set<string>()
): string | null {
  const asset = assets[assetId];
  const bytes = buildResolvedEpubAssetBytes(assetId, assets, visited);

  if (!asset || !bytes) {
    return null;
  }

  return toDataUrl(bytes, asset.mimeType || "application/octet-stream");
}

export function buildResolvedEpubAssetFile(
  assetId: string,
  assets: Record<string, ParsedEpubAsset>
): File | null {
  const asset = assets[assetId];
  const bytes = buildResolvedEpubAssetBytes(assetId, assets);

  if (!asset || !bytes) {
    return null;
  }

  return new File([Uint8Array.from(bytes)], asset.fileName, {
    type: asset.mimeType || "application/octet-stream"
  });
}
