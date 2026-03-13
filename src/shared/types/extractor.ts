export type ExtractorMode = "outline" | "pages";

export interface ExtractorTelegraphSettingsStatus {
  configured: boolean;
  shortName: string | null;
  authorName: string | null;
  authorUrl: string | null;
  updatedAt: string | null;
}

export interface ExtractorTelegraphPartPage {
  title: string;
  url: string;
  path: string;
  partNumber: number;
}

export interface ExtractorTelegraphPublishResult {
  indexPageUrl: string | null;
  indexPagePath: string | null;
  partPages: ExtractorTelegraphPartPage[];
  publishedAt: string;
  warnings: string[];
}

export interface ExtractorTelegraphPublishPayload {
  blocks: ExtractorResultBlock[];
  documentFormat: string;
  documentId: number;
  documentTitle: string;
  mode: ExtractorMode;
  selectionSummary: string[];
}

export interface ExtractorTelegraphPublishAssetDescriptor {
  assetId: string;
  fieldName: string;
  fileName: string;
  mimeType: string;
}

export interface ExtractorTelegraphPublishRequest extends ExtractorTelegraphPublishPayload {
  assets: ExtractorTelegraphPublishAssetDescriptor[];
}

export interface ExtractorDocumentSummary {
  id: number;
  title: string;
  author: string;
  language: string;
  format: string;
  storageKey: string;
  createdAt: string;
  capabilities: {
    outline: boolean;
    pageRanges: boolean;
  };
}

export interface ExtractorBootstrap {
  documents: ExtractorDocumentSummary[];
  infrastructure: {
    d1: boolean;
    r2: boolean;
    mode: string;
  };
}

export interface ExtractorOutlineNode {
  id: string;
  label: string;
  href: string | null;
  children: ExtractorOutlineNode[];
}

export interface ExtractorPageRange {
  start: number;
  end: number;
}

export interface ExtractorSelection {
  mode: ExtractorMode;
  outlineNodeIds: string[];
  pageRanges: ExtractorPageRange[];
}

export type ExtractorResultBlock =
  | {
      type: "section-break";
      label: string;
    }
  | {
      type: "page-break";
      label: string;
      pageNumber: number;
    }
  | {
      type: "heading";
      level: number;
      text: string;
      sourceLabel?: string;
    }
  | {
      type: "paragraph";
      text: string;
      sourceLabel?: string;
    }
  | {
      type: "list-item";
      text: string;
      sourceLabel?: string;
    }
  | {
      type: "quote";
      text: string;
      sourceLabel?: string;
    }
  | {
      type: "image";
      assetId: string;
      alt: string;
      caption: string;
      mimeType: string;
      pageNumber?: number;
      sourceLabel?: string;
    };

export interface ExtractorResult {
  documentId: number;
  documentTitle: string;
  documentFormat: string;
  mode: ExtractorMode;
  selectionSummary: string[];
  sourceRefs?: string[];
  blocks: ExtractorResultBlock[];
  text: string;
  charCount: number;
  sourceCount: number;
  generatedAt: string;
  warnings: string[];
}

export interface ExtractorDocumentAnalysis {
  documentId: number;
  format: string;
  outline: ExtractorOutlineNode[];
  supportsOutline: boolean;
  supportsPageRanges: boolean;
  pageCount: number | null;
  warnings: string[];
}
