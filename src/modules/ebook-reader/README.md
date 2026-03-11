# Ebook Reader Module

## Purpose

`ebook-reader` is an English novel reading module backed by Cloudflare.

It is built for EPUB-based reading and vocabulary tracking:

- import reflowable English EPUB books into R2
- import dictionary data and learned lemmas into D1
- restore reading progress from EPUB CFI
- detect the current page's unknown words with lemma-based matching
- let the user click or select a word in the book and inspect its meaning in the side panel
- mark a selected word as learned or save it into the explicit unknown-word list
- batch mark all unknown lemmas on the current page as learned
- export the saved unknown-word list for the current book as a CSV generated on the server
- adjust reading font size and reflow pagination with updated total-page calculation
- present the module in the Pencil-defined workspace layout, with a command header, focused reading canvas, fixed word-detail panel, and import/export status cards

## Directory Structure

```txt
src/modules/ebook-reader/
  manifest.ts         Module registration metadata
  view.tsx            Module-level orchestration, imports, state, and layout composition
  ReaderSidebar.tsx   Module-specific navigation rail and import/export command surface
  ReaderViewport.tsx  epub.js reading surface, pagination, selection, highlighting, font reflow
  view.module.css     Reading layout and module-specific styling
```

## Key Integration Points

### Frontend

- [view.tsx](/Users/welann/Documents/code/daily/PageNest/src/modules/ebook-reader/view.tsx)
  - loads bootstrap data from `/api/reader/bootstrap`
  - merges the built-in ECDICT subset with user-imported dictionary entries
  - owns selected book, selected word, current-page unknown words, saved unknown words, and upload state
  - maps the persisted reader state onto the Pencil-inspired workspace UI without changing the existing backend contracts
  - composes the left reading rail, central reader viewport, and right-side detail/status panels
  - coordinates actions such as importing EPUB/dictionary/learned words, marking learned lemmas, saving unknown words, and triggering exports
- [ReaderSidebar.tsx](/Users/welann/Documents/code/daily/PageNest/src/modules/ebook-reader/ReaderSidebar.tsx)
  - renders the module-local navigation rail instead of relying on the global workspace sidebar
  - keeps the workspace return entry visible while surfacing import/export commands in a dedicated reader-side command area
  - provides a matching mobile sheet so the same controls remain reachable on smaller screens
- [ReaderViewport.tsx](/Users/welann/Documents/code/daily/PageNest/src/modules/ebook-reader/ReaderViewport.tsx)
  - renders EPUB content with `epub.js`
  - tracks current locator and progress percent
  - evaluates visible text against the vocabulary lookup
  - highlights unknown words in the current rendered page
  - supports direct word selection from the EPUB iframe
  - applies reader typography updates and rebuilds page counts after font-size changes
  - renders the reader chrome used by the new workspace design: metadata row, focused reading card, and page navigation bar

### Shared Reader Logic

- [vocabulary.ts](/Users/welann/Documents/code/daily/PageNest/src/shared/reader/vocabulary.ts)
  - tokenization, lemma normalization, irregular form handling, and learned-word matching
- [defaultDictionary.ts](/Users/welann/Documents/code/daily/PageNest/src/shared/reader/defaultDictionary.ts)
  - lazy loads the built-in ECDICT subset
- [reader.ts](/Users/welann/Documents/code/daily/PageNest/src/shared/types/reader.ts)
  - shared payload and persistence types for books, learned lemmas, unknown lemmas, exports, and bootstrap state
- [reader.ts](/Users/welann/Documents/code/daily/PageNest/src/services/api/reader.ts)
  - client-side API wrapper for all reader endpoints

### Cloudflare Backend

- [reader-data.ts](/Users/welann/Documents/code/daily/PageNest/functions/_lib/reader-data.ts)
  - D1/R2 binding checks
  - bootstrap assembly
  - mapping between SQL rows and shared reader types
- [reader-import.ts](/Users/welann/Documents/code/daily/PageNest/functions/_lib/reader-import.ts)
  - dictionary and learned-word import parsing/upsert
- [reader-epub.ts](/Users/welann/Documents/code/daily/PageNest/functions/_lib/reader-epub.ts)
  - EPUB metadata parsing and export helpers
- `functions/api/reader/**`
  - Cloudflare Pages Functions for bootstrap, uploads, progress updates, learned words, unknown words, book file delivery, and export download

## Data Flow

1. The module loads bootstrap data from D1 through `/api/reader/bootstrap`.
2. The frontend merges the built-in default dictionary with user-imported dictionary records and builds a vocabulary lookup.
3. `view.tsx` composes the workspace layout around the current bootstrap snapshot and wires the reader rail, viewport toolbar, and detail panel actions to the existing reader APIs.
4. The selected EPUB is loaded from R2 into `epub.js`.
5. On `rendered` and `relocated`, the reader:
   - applies typography to the rendered EPUB contents
   - extracts visible text tokens
   - maps each token to a lemma
   - skips learned lemmas and ignored tokens
   - highlights unknown words on the current page
6. When the user selects a word:
   - the sidebar shows lemma, surface form, and dictionary meaning
   - the user can mark it as learned or save it into the current book's unknown list
7. Export requests are handled on the server, written to R2, and surfaced back through the latest-export API.

## Storage Model

- D1
  - `reader_library_items`
  - `reader_progress`
  - `reader_dictionary_entries`
  - `reader_learned_lemmas`
  - `reader_unknown_lemmas`
  - `reader_exports`
- R2
  - original EPUB files
  - generated CSV exports

The browser may cache data temporarily for UX, but D1 and R2 remain the source of truth.

## Notable User-Facing Features Added In This Iteration

- Cloudflare-backed EPUB import and bookshelf persistence
- built-in default dictionary derived from ECDICT
- current-page unknown-word detection with lemma matching
- click-or-select word inspection in the side panel
- mark selected word as learned
- save selected word into an explicit unknown-word list
- batch mark all unknown lemmas on the current page as learned
- server-side CSV export for saved unknown words
- adjustable reading font size with automatic reflow and total-page recalculation
- Pencil-aligned reader workspace redesign while preserving the existing Cloudflare API surface and storage model
- dedicated reader-side navigation rail with a clear return path back to the main workspace

## Maintenance Notes

- Apply both reader migrations before using the module remotely:
  - [0002_reader_cloudflare.sql](/Users/welann/Documents/code/daily/PageNest/db/migrations/0002_reader_cloudflare.sql)
  - [0003_reader_unknown_words.sql](/Users/welann/Documents/code/daily/PageNest/db/migrations/0003_reader_unknown_words.sql)
- The built-in dictionary asset is generated by [build_default_ecdict.mjs](/Users/welann/Documents/code/daily/PageNest/scripts/build_default_ecdict.mjs). If the subset changes, rebuild the asset before deployment.
- The reader currently targets reflowable English EPUBs. Fixed-layout EPUBs or non-English-specific vocabulary rules will need separate handling.
- Font-size changes intentionally trigger page-index rebuilds. This is expected and is necessary for correct total-page reporting.
