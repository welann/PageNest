# Content Extractor Module

## Purpose

`content-extractor` is a shared-library extraction workspace for EPUB and PDF files.

It lets the user:

- upload EPUB or PDF files into the shared `reader_library_items` shelf
- choose an existing library document without leaving the module
- extract EPUB content by table of contents / chapter outline
- extract PDF content by bookmark outline when available
- extract PDF content by one or more page ranges
- preview the extracted result in a structured reading layout
- copy the generated text without persisting extraction history

V1 intentionally keeps a narrow scope:

- EPUB does **not** support page-range extraction
- PDF outline extraction depends on native bookmarks
- scanned PDFs / OCR are not supported
- extraction results live only in the current browser session

## Directory Structure

```txt
src/modules/content-extractor/
  manifest.ts            Module registration metadata
  view.tsx               Module orchestration, async state, layout, and extraction workflow
  ExtractorSidebar.tsx   Module submenu panel mounted into the shared shell sidebar
  README.md              Module documentation
```

## Key Integration Points

### Frontend

- `view.tsx`
  - loads shared-library documents from `/api/extractor/bootstrap`
  - uploads EPUB/PDF files through `/api/extractor/library/import`
  - fetches selected source files from `/api/reader/books/:id/file`
  - analyzes EPUB/PDF content client-side and keeps extraction state in memory
  - resets selections and results whenever the active document changes
  - renders the library shelf, extraction builder, and preview desk in the shared workspace shell
- `ExtractorSidebar.tsx`
  - injects the module submenu into the global left sidebar
  - exposes upload, copy, clear, and current-session summary controls

### Shared Extractor Logic

- `src/shared/types/extractor.ts`
  - shared module payloads, analysis metadata, selections, and preview result types
- `src/shared/extractor/epubArchive.ts`
  - ZIP-based EPUB metadata, spine, outline, and structured block extraction
- `src/shared/extractor/epubSelection.ts`
  - EPUB outline analysis and outline-to-section-range mapping
- `src/shared/extractor/pdf.ts`
  - PDF bootstrap analysis, bookmark-to-range mapping, and extraction orchestration
- `src/shared/extractor/pdfText.ts`
  - PDF text-line grouping, paragraph reconstruction, and scanned-page warnings
- `src/shared/extractor/selection.ts`
  - page-range parsing/merging and result serialization for clipboard export

### Cloudflare Backend

- `functions/api/extractor/bootstrap.ts`
  - returns the shared document list for the extractor module
- `functions/api/extractor/library/import.ts`
  - accepts EPUB/PDF uploads and writes them into the shared R2 + D1 library
- `functions/_lib/extractor-data.ts`
  - extractor bootstrap mapping and shared-library persistence helpers
- `functions/_lib/reader-epub.ts`
  - now delegates EPUB parsing to the shared extractor parser so reader import and extractor analysis stay aligned

## Data Flow

1. The module loads shared-library documents from `/api/extractor/bootstrap`.
2. When the user selects a document, the browser downloads the raw file from `/api/reader/books/:id/file`.
3. Analysis then splits by format:
   - EPUB: parse archive, build outline ranges, and prepare structured section blocks
   - PDF: inspect page count and bookmark outline, then defer text extraction until the user submits a range
4. The user chooses either:
   - outline mode for EPUB or bookmarked PDF
   - page-range mode for PDF
5. The module converts the selection into deterministic source ranges and builds a structured preview result.
6. The preview stays in memory only; copy actions serialize the same structured blocks into plain text.

## Maintenance Notes

- The module reuses the existing shared library table `reader_library_items`; this iteration does not rename storage tables.
- EPUB analysis relies on structured XHTML parsing when a DOM parser is available and falls back to plain-text sections otherwise.
- PDF extraction uses `pdfjs-dist` on the client, so scanned/image-only PDFs surface warnings instead of OCR output.
- Automated tests cover range parsing, outline range derivation, EPUB parsing, PDF text grouping, and sidebar rendering.
