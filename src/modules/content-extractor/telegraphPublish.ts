import type { ParsedEpubDocument } from "@shared/extractor/epubSelection";
import type { ParsedPdfDocument } from "@shared/extractor/pdf";
import { buildResolvedEpubAssetFile } from "@modules/content-extractor/epubAssets";
import type {
  ExtractorResult,
  ExtractorResultBlock,
  ExtractorTelegraphPublishRequest
} from "@shared/types/extractor";

type PreparedDocument =
  | {
      kind: "epub";
      value: ParsedEpubDocument;
    }
  | {
      kind: "pdf";
      value: ParsedPdfDocument;
    };

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getImageBlocks(blocks: ExtractorResultBlock[]) {
  const seen = new Set<string>();

  return blocks.filter((block): block is ExtractorResultBlock & { type: "image" } => {
    if (block.type !== "image" || seen.has(block.assetId)) {
      return false;
    }

    seen.add(block.assetId);
    return true;
  });
}

async function renderPdfPageAsFile(
  parsed: ParsedPdfDocument,
  block: ExtractorResultBlock & { type: "image" }
) {
  if (typeof document === "undefined") {
    throw new Error("PDF page rendering requires a browser document.");
  }

  if (typeof block.pageNumber !== "number") {
    throw new Error(`PDF image block ${block.assetId} is missing a page number.`);
  }

  const page = await parsed.pdf.getPage(block.pageNumber);
  const viewport = page.getViewport({ scale: 1.75 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D rendering is unavailable for PDF export.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({
    canvas,
    canvasContext: context,
    viewport
  }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error(`Failed to render PDF page ${block.pageNumber} as a PNG asset.`));
        return;
      }

      resolve(nextBlob);
    }, "image/png");
  });

  return new File([blob], `pdf-page-${block.pageNumber}.png`, {
    type: "image/png"
  });
}

export async function buildTelegraphPublishRequest(
  result: ExtractorResult,
  preparedDocument: PreparedDocument
) {
  const imageBlocks = getImageBlocks(result.blocks);
  const files = new Map<string, File>();
  const assets: ExtractorTelegraphPublishRequest["assets"] = [];

  for (const [index, block] of imageBlocks.entries()) {
    let file: File | null = null;

    if (preparedDocument.kind === "epub") {
      file = buildResolvedEpubAssetFile(block.assetId, preparedDocument.value.archive.assets);

      if (file) {
        file = new File([file], sanitizeFileName(file.name) || `asset-${block.assetId}`, {
          type: file.type || block.mimeType
        });
      }
    } else {
      file = await renderPdfPageAsFile(preparedDocument.value, block);
    }

    if (!file) {
      continue;
    }

    const fieldName = `asset-${index + 1}`;

    files.set(block.assetId, file);
    assets.push({
      assetId: block.assetId,
      fieldName,
      fileName: file.name,
      mimeType: file.type || block.mimeType
    });
  }

  return {
    files,
    payload: {
      assets,
      blocks: result.blocks,
      documentFormat: result.documentFormat,
      documentId: result.documentId,
      documentTitle: result.documentTitle,
      mode: result.mode,
      selectionSummary: result.selectionSummary
    }
  };
}
