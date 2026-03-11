# PageNest

PageNest is a private, Cloudflare-first workspace focused on the `ebook-reader` module and its supporting reading workflow. This scaffold favors maintainability over feature count:

- `React + Vite + Tailwind CSS` for a lean client shell
- `shadcn/ui` for the shared shell and surface component system
- `Cloudflare Pages Functions` for API endpoints
- `D1` for structured personal state
- `R2` for large assets such as books, covers, and exports
- Code-based module manifests instead of runtime plugin installation

## Project layout

```txt
src/
  app/              App shell and routes
  components/       Reusable shell pieces and shadcn/ui primitives
  features/         Route-level feature composition
  modules/          Self-contained page modules
  server/           Data schema and server-only helpers
  services/         Client API access
  shared/           Shared types, styling tokens, and utilities
functions/
  api/              Cloudflare Pages Function endpoints
db/
  migrations/       D1 SQL migrations
```

## Getting started

1. Install dependencies: `npm install`
2. Create your D1 database and R2 bucket in Cloudflare
3. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml`
4. Apply local migrations: `npm run db:migrate:local`
5. Start the UI locally: `npm run dev`
6. Start the full Cloudflare preview when needed: `npm run cf:dev`

## Deploy to Cloudflare Pages

This repository is already structured for Cloudflare Pages:

- static assets are built into `dist`
- API endpoints live in `functions/`
- D1 is bound as `DB`
- R2 is bound as `LIBRARY_BUCKET`

Recommended first production deployment flow:

1. Log in to Cloudflare: `npx wrangler login`
2. Create the Pages project once: `npx wrangler pages project create pagenest --production-branch main`
3. Create the D1 database: `npx wrangler d1 create pagenest`
4. Copy the returned `database_id` into `wrangler.toml`
5. Create the R2 buckets:
   - `npx wrangler r2 bucket create pagenest-library`
   - `npx wrangler r2 bucket create pagenest-library-preview`
6. Apply remote migrations: `npx wrangler d1 migrations apply pagenest --remote`
7. Build and deploy:
   - `npm run build`
   - `npx wrangler pages deploy dist --project-name pagenest`

Notes:

- The current `wrangler.toml` is the source of truth for Pages configuration because it includes `pages_build_output_dir`.
- `APP_ENV` is currently set to `development`; that does not block deployment, but production responses will report that value until you override it for preview/production.
- The `public/_redirects` file rewrites client-side routes back to `index.html`, so refreshing routes like `/m/ebook-reader` will keep working on Pages.
- After deployment, verify `/api/health` to confirm that D1 and R2 bindings are attached correctly.

## Core design rules

- Module metadata lives in code
- Personal state lives in D1
- Large files live in R2
- New modules are added under `src/modules/<slug>`
- Module views are lazy-loaded to keep the shell small
- The shell and home surface use `shadcn/ui` tokens and components
- SQL migrations are hand-authored in `db/migrations/` for now

## Modules

### Ebook Reader

The Ebook Reader module is a Cloudflare-backed EPUB reading workflow for English novel study, now presented in the Pencil-defined workspace UI while keeping the same import, progress, vocabulary, and export APIs.

It is currently the only retained module in this repository.

Current capabilities:

- import EPUB books into R2 and track progress in D1
- preload a default ECDICT subset plus user-imported dictionary data
- use the shared left workspace sidebar, with a reader-specific submenu for commands, selected-word actions, and reading status
- keep the current-page bulk learning action in the reader toolbar so it stays attached to the active reading context
- detect unknown words on the current page with lemma-based matching
- inspect a clicked or selected word in the shared sidebar submenu
- mark words or the whole current page as learned
- save explicit unknown words and export them as server-generated CSV files
- preserve explicitly saved unknown words when bulk-marking the current page as learned, while still allowing manual single-word learning to clear them
- adjust reader font size and automatically reflow pagination
- update imported books, dictionary data, learned words, unknown-word state, and export metadata immediately in the UI without requiring a page refresh

Detailed module documentation: [src/modules/ebook-reader/README.md](./src/modules/ebook-reader/README.md)
