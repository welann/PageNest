# Content Extractor Module

## Purpose

`content-extractor` is a shared-library extraction workspace for EPUB and PDF files.

It lets the user:

- upload EPUB or PDF files into the shared `reader_library_items` shelf
- choose an existing library document without leaving the module
- extract EPUB content by table of contents / chapter outline
- extract PDF content by bookmark outline when available
- extract PDF content by one or more page ranges
- keep ordered image blocks for EPUB sections and image-bearing PDF pages
- preview EPUB selections through `epub.js` section rendering so inline images, SVG, and chapter styling stay close to the source book
- keep a parallel structured reading summary for copy, validation, and Telegraph publishing
- copy the generated text without persisting extraction history
- publish the current extraction result to Telegraph as one or more public pages

V1 intentionally keeps a narrow scope:

- EPUB does **not** support page-range extraction
- PDF outline extraction depends on native bookmarks
- PDF image preservation is page-level; image-bearing pages are exported as page screenshots plus text, not element-level reflow
- scanned PDFs / OCR are not supported
- extraction results live only in the current browser session, while Telegraph assets are persisted in R2 for published pages

## Directory Structure

```txt
src/modules/content-extractor/
  manifest.ts            Module registration metadata
  view.tsx               Module orchestration, async state, layout, and extraction workflow
  EpubPreviewSurface.tsx EPUB.js-backed section preview for extracted EPUB results
  ExtractorSidebar.tsx   Module submenu panel mounted into the shared shell sidebar
  telegraphPublish.ts    Browser-side asset preparation for Telegraph publishing
  README.md              Module documentation
```

## Key Integration Points

### Frontend

- `view.tsx`
  - loads shared-library documents from `/api/extractor/bootstrap`
  - uploads EPUB/PDF files through `/api/extractor/library/import`
  - loads/saves workspace Telegraph settings through `/api/extractor/telegraph/settings`
  - publishes the current extraction through `/api/extractor/telegraph/publish`
  - fetches selected source files from `/api/reader/books/:id/file`
  - analyzes EPUB/PDF content client-side and keeps extraction state in memory
  - resets selections and results whenever the active document changes
  - renders the library shelf, extraction builder, EPUB.js preview desk, structured extraction summary, and Telegraph publishing controls in the shared workspace shell
- `EpubPreviewSurface.tsx`
  - loads `epub.js` on demand so EPUB preview code stays out of the default shell bundle
  - renders the extracted EPUB section list directly from the original source buffer instead of reassembling HTML by hand
  - keeps iframe height in sync with late-loading images so long illustrated chapters remain readable inline
- `ExtractorSidebar.tsx`
  - injects the module submenu into the global left sidebar
  - exposes upload, copy, Telegraph publish, Telegraph settings, and current-session summary controls
- `telegraphPublish.ts`
  - turns the current extraction result into a multipart Telegraph publish request
  - resolves EPUB image assets from the parsed archive
  - renders image-bearing PDF pages into PNG files before upload

### Shared Extractor Logic

- `src/shared/types/extractor.ts`
  - shared module payloads, analysis metadata, selections, and preview result types
- `src/shared/extractor/epubArchive.ts`
  - ZIP-based EPUB metadata, spine, outline, structured block extraction, and embedded image asset capture
- `src/shared/extractor/epubSelection.ts`
  - EPUB outline analysis and outline-to-section-range mapping
- `src/shared/extractor/pdf.ts`
  - PDF bootstrap analysis, bookmark-to-range mapping, image-page detection, and extraction orchestration
- `src/shared/extractor/telegraph.ts`
  - Telegraph node serialization, part splitting, and index-page generation
- `src/shared/extractor/pdfOps.ts`
  - pure PDF operator heuristics used to detect image-bearing pages
- `src/shared/extractor/pdfText.ts`
  - PDF text-line grouping, paragraph reconstruction, and scanned-page warnings
- `src/shared/extractor/selection.ts`
  - page-range parsing/merging and result serialization for clipboard export

### Cloudflare Backend

- `functions/api/extractor/bootstrap.ts`
  - returns the shared document list for the extractor module
- `functions/api/extractor/library/import.ts`
  - accepts EPUB/PDF uploads and writes them into the shared R2 + D1 library
- `functions/api/extractor/telegraph/settings.ts`
  - reads and saves workspace Telegraph settings in `app_settings`
- `functions/api/extractor/telegraph/publish.ts`
  - receives the ordered extraction result plus image files and publishes Telegraph pages
- `functions/api/extractor/telegraph/assets/[jobId]/[assetName].ts`
  - serves long-lived published image assets from the `telegraph-assets/` R2 namespace
- `functions/_lib/extractor-data.ts`
  - extractor bootstrap mapping and shared-library persistence helpers
- `functions/_lib/extractor-telegraph.ts`
  - Telegraph account validation, R2 asset storage, and page/index publishing
- `functions/_lib/reader-epub.ts`
  - now delegates EPUB parsing to the shared extractor parser so reader import and extractor analysis stay aligned

## Data Flow

1. The module loads shared-library documents from `/api/extractor/bootstrap`.
2. When the user selects a document, the browser downloads the raw file from `/api/reader/books/:id/file`.
3. Analysis then splits by format:
   - EPUB: parse archive, build outline ranges, and prepare structured section blocks with referenced image assets
   - PDF: inspect page count and bookmark outline, then detect image-bearing pages as ranges are extracted
4. The user chooses either:
   - outline mode for EPUB or bookmarked PDF
   - page-range mode for PDF
5. The module converts the selection into deterministic source ranges and builds a structured preview result.
6. The preview stays in memory only; EPUB result pages are re-rendered from the original archive through `epub.js`, while copy actions still serialize the structured blocks into plain text.
7. If the user publishes to Telegraph, the browser converts image blocks into files, the server stores those files in R2, and the same ordered blocks are transformed into Telegraph nodes and split into part pages when needed.

## Maintenance Notes

- The module reuses the existing shared library table `reader_library_items`; this iteration does not rename storage tables.
- EPUB analysis relies on structured XHTML parsing when a DOM parser is available and falls back to plain-text sections otherwise.
- EPUB webpage preview intentionally uses `epub.js` instead of the extractor blocks so complex image/SVG/resource paths render more faithfully for the current selection.
- PDF extraction uses `pdfjs-dist` on the client, so scanned/image-only PDFs surface warnings instead of OCR output.
- Telegraph account settings are stored in `app_settings`; the access token is never returned to the client after save.
- Published Telegraph images are served from `telegraph-assets/` in the shared R2 bucket so the public pages remain valid after the browser session ends.
- Automated tests cover range parsing, outline range derivation, EPUB image parsing, PDF text grouping, Telegraph splitting, and sidebar rendering.
