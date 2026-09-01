# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Setup Manager HUD is a webhook dashboard for [Setup Manager](https://github.com/jamf/setup-manager). It ingests Jamf Setup Manager webhooks, stores events in an embedded SQLite database (or Cloudflare D1), and renders a polling React dashboard styled with Jamf Nebula.

This is a **cloud-agnostic** implementation with three deploy lanes:
- **Container** (Docker / docker-compose) — see `docs/deploy/container.md`
- **Fly.io** (always-on, persistent volume) — see `docs/deploy/fly.md`
- **Cloudflare Workers** (serverless, D1) — see `docs/deploy/cloudflare.md`

## Commands

```bash
npm test                # Run Vitest test suite
npm run typecheck       # tsc --noEmit
npm run build:frontend  # Vite build → public/
npm start               # Node container server (requires WEBHOOK_TOKEN env var)
npm run deploy:cf       # Apply D1 migrations + wrangler deploy (Cloudflare lane)
```

Generate a webhook token:
```bash
openssl rand -hex 24
```

Set for local Node development:
```bash
export WEBHOOK_TOKEN=<your-token>
npm start
```

Set for Cloudflare Workers:
```bash
npx wrangler secret put WEBHOOK_TOKEN
```

## Architecture

A single Hono `app` (`src/app.ts`) handles all routes using only Fetch-standard APIs. Two thin entry points wire a store to the shared app:

- **`src/server.ts`** — Node container: instantiates `SqliteStore`, serves static SPA + app
- **`src/worker.ts`** — Cloudflare Workers: instantiates `D1Store`, exports `app.fetch`

The `Store` interface (`src/store/store.ts`) abstracts the database so `app.ts` never imports platform-specific modules.

Real-time is replaced by adaptive client polling: the frontend polls `/api/events?since=<ts>` with `If-None-Match` / ETag → HTTP 304 backoff (3 s → 15 s).

The frontend is a React 19 + Vite SPA styled with Jamf Nebula (`@jamf/design-system-web-components-next`). Built to `public/` at image-build or deploy time.

### Store adapters

- `src/store/sqlite-store.ts` — `better-sqlite3`, runs migrations on construct, stores data at `DB_PATH` (`/data/hud.sqlite` by default)
- `src/store/d1-store.ts` — Cloudflare D1

### Migrations

Owned in-repo at `migrations/`. Applied automatically by `SqliteStore` on startup (Node); applied by `wrangler d1 migrations apply` for Cloudflare.

### Cloudflare bindings (wrangler.toml)

- `DB` — D1 database for event persistence
- `ASSETS` — static SPA files from `public/`
- `WEBHOOK_TOKEN` — required shared secret (set via `wrangler secret put`)
- Optional: `CF_ACCESS_AUD` and `CF_ACCESS_TEAM_DOMAIN` for Cloudflare Access protection

## Critical Security Constraints

**These constraints must never be removed or weakened:**

- **`WEBHOOK_TOKEN` is required on every path.** Missing/blank token → container startup fails clearly; Workers request fails clearly. Constant-time compare only (`timingSafeEqual`). Never log the token.

- **Keep `.dev.vars.example` containing `WEBHOOK_TOKEN=`.** Cloudflare uses this file for the Deploy Button flow — removing it or the entry breaks one-click deployment.

- **Keep `[secrets] required = ["WEBHOOK_TOKEN"]` in `wrangler.toml`.** Makes manual deploys fail clearly when the token has not been configured.

- **Do NOT reintroduce `/api/events/:id/archive` or `/api/events/:id/disabled`.** These URL shapes are blocked by browser content blockers. Use only `POST /api/records/visibility` with `{eventId, hidden}`.

- **Disabled = hidden, never deleted.** Records with `is_archived = 1` remain in the database and can be re-enabled. Do not implement deletion.
