# PageNest

PageNest is a private, Cloudflare-first workspace for collecting AI-built page modules in one place. This scaffold favors maintainability over feature count:

- `React + Vite` for a lean client shell
- `Cloudflare Pages Functions` for API endpoints
- `D1` for structured personal state
- `R2` for large assets such as books, covers, and exports
- Code-based module manifests instead of runtime plugin installation

## Project layout

```txt
src/
  app/              App shell and routes
  components/       Reusable UI and shell pieces
  features/         Route-level feature composition
  modules/          Self-contained page modules
  server/           Data schema and server-only helpers
  services/         Client API access
  shared/           Shared types and utilities
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

## Core design rules

- Module metadata lives in code
- Personal state lives in D1
- Large files live in R2
- New modules are added under `src/modules/<slug>`
- Module views are lazy-loaded to keep the shell small
- SQL migrations are hand-authored in `db/migrations/` for now
