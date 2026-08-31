# Setup Manager HUD — Cloud-Agnostic Redesign

**Date:** 2026-08-31
**Status:** Approved design, pre-implementation
**Branch:** `aws-architecture-plan`

## Goal

Turn Setup Manager HUD from a Cloudflare-locked deployment into a
**simple, cloud-agnostic visualization tool** that ingests Jamf Setup
Manager webhooks and renders a live-ish dashboard. A customer should be
able to deploy it to the environment of their choice (any container
host, Fly.io, or Cloudflare) by following one clear guide for that
environment.

Non-goal: maintaining per-cloud serverless function adapters
(Lambda/Azure Functions/GCP Functions). The container image is the
universal artifact; Cloudflare is kept as a distinct second path.

## Context: what exists today

- This repo is an 18-line wrapper (`src/index.ts`) around the external
  npm package `@motionbug/setupmanagerhud-core@1.2.5`.
- The core ships: a compiled React 19 + recharts SPA (source not
  available to us), a Fetch-standard `app.fetch` handler, and a
  `DashboardRoom` Durable Object.
- Cloudflare coupling: **D1** (SQLite) for storage, **Durable Objects**
  for WebSocket real-time push (`/ws`, `/broadcast`, `/connections`),
  **ASSETS** binding for static serving.
- The compiled frontend hard-codes a **WebSocket** connection.
- Existing routes: `/webhook`, `/api/events`, `/api/stats`,
  `/api/health`, `/api/config`, `/ws`, plus the newer
  `/api/records` + `/api/records/visibility` visibility API.
- Two SQLite migration files exist and are platform-neutral.

## Key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Core ownership | Fork / reimplement freely | We own the redesign; frontend rebuilt from scratch. |
| Real-time model | **Polling** (adaptive) | Setup Manager events arrive at human pace; polling removes all persistent-connection infra and is the single biggest portability win. |
| Packaging | **Single container image** | One artifact runs on every container host; "deploy anywhere" becomes literally true. |
| Storage | **Embedded SQLite on a mounted volume** | Zero external services; migrations reused; durable via a persistent disk. |
| Storage vs cost | **Always-on container + volume** | Honors embedded SQLite; ~$3-7/mo; no scale-to-zero data-loss risk. |
| Frontend | **Fresh SPA rebuilt on Jamf Nebula** | No compiled-bundle source; Nebula gives genuine Jamf-brand fidelity. |
| Cloudflare path | **Kept, separated** | Retained as a distinct deploy lane via a storage abstraction + second entry point. |

## Architecture

A single stateless-except-for-disk HTTP application, one container
image, no platform SDKs in the core logic.

```
Setup Manager ──POST /webhook──▶ [ingest] ──▶ SQLite (mounted volume)
Browser ──GET /api/events (adaptive poll)──▶ [read API] ──▶ SQLite
Browser ──GET / ──▶ [static] serves polling SPA from disk
```

Runtime: **Node HTTP server** using **Hono** (Fetch-standard router).
Keeping the handler Fetch-standard means the exact same `app` runs on
Cloudflare Workers unmodified — no Durable Objects, no WebSocket.

Removed entirely: Durable Objects, `/ws`, `/broadcast`, `/connections`,
the `ASSETS` binding concept (Node serves from disk).

## Components (isolated units)

### 1. Storage abstraction (`Store` interface)
One interface, two adapters. All app logic depends only on the
interface.

Methods: `insertOrUpdateEvent(record)`, `queryEvents(filters)`,
`stats(filters)`, `records(state)`, `setVisibility(eventId, hidden)`,
`health()`, `migrate()`.

- **`SqliteStore`** — local file (e.g. `better-sqlite3` or `node:sqlite`),
  for container / Fly.io / VPS / local. Runs migrations on startup.
- **`D1Store`** — Cloudflare D1, for the Workers path. Same SQL,
  migrations applied via wrangler.

### 2. Webhook ingest (`POST /webhook`)
- Bearer token auth via constant-time compare (`timingSafeEqual`,
  ported to `node:crypto` / Web Crypto — no CF dependency).
- Parse Jamf payload (`name`, `event`, `timestamp`, `serialNumber`,
  `modelName`, `modelIdentifier`, `macOSVersion`, `macOSBuild`,
  `started`, `finished`, `duration`, `computerName`,
  `enrollmentActions[] {label,status}`, throughput).
- Derive flat columns (`failed_action_count`, `total_action_count`,
  `has_failed_actions`, `duration_seconds`, etc.) by walking
  `enrollmentActions`.
- **Enrollment identity: `serialNumber + started`.** A `Started` and its
  later `Finished` collapse into one row (upsert). Idempotent under
  webhook retries.

### 3. Read API
All plain JSON HTTP.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/events` | List with filters: `limit`, `offset`, `eventType`, `failedOnly`, `macOSVersion`, `model`, `serial`, `search`, `timeRange`. Supports conditional `?since=<ts>` / ETag → `304` when unchanged. |
| `GET /api/stats` | SQL-computed aggregates (totals, failure rate, throughput averages). |
| `GET /api/records` (+ `?state=hidden`) | Active vs. disabled lists. |
| `POST /api/records/visibility` | `{eventId, hidden}` toggle. |
| `GET /api/config` | `APP_TITLE`, `LOGO_URL` for the SPA. |
| `GET /api/health` | `{status, db: connected}`. Drops CF-specific `durable_objects`/`connections` fields. |

Do NOT reintroduce blocked URL shapes (`/api/events/:id/archive`,
`/api/events/:id/disabled`) — content blockers flagged them.

### 4. Polling model (adaptive)
- Server tracks a monotonic latest-event timestamp.
- `GET /api/events?since=<ts>` (or `If-None-Match` ETag) returns `304`
  with empty body when nothing changed.
- Client adaptive interval: ~3s after recent activity, back off to ~15s
  when idle. Feels live for a wall-board; near-free when idle.

### 5. Frontend (fresh SPA)
- React 19 + Vite, built to static files at image-build time, served
  from disk.
- **Styled with Jamf Nebula design system** (CSS variables, utility
  classes, components) as the source of truth for Jamf's visual
  language. Fetch exact component specs via the `jamf-nebula` MCP
  (`jamf-get-component`) at implementation time.
- Components mapped to Nebula: **Chart** (volume-over-time, failure
  rate, throughput, model/OS breakdown), **Card** + `g-wrap` grid for
  layout, **DataTable** for records, **Tabs** for Active/Disabled,
  **TopNav** for header (title/logo from `/api/config`),
  **Badge/Tag/Indicator** for status, **AlertBanner** for degraded
  health, **Spinner/LoadingSkeleton** for loading, **Indicator** for the
  live/idle signal (replaces the old WebSocket dot).
- `useEvents()` hook owns the adaptive poll loop, `since`/ETag
  conditional fetching, exposes `{events, stats, isLive}`.
- Filter controls map to `/api/events` query params; per-row hide/show
  hits `/api/records/visibility`.
- Fidelity note: a faithful **reconstruction** of the current views
  (not byte-identical to the compiled bundle), using Nebula + reusable
  package assets (Figtree font, existing icons/logos).

### 6. Entry points (shared core)
- `src/server.ts` — Node container host. Instantiates `SqliteStore`,
  runs migrations, serves static SPA + Hono `app`.
- `src/worker.ts` — Cloudflare Workers. Instantiates `D1Store`, exports
  Hono `app.fetch`. No Durable Object.
- Shared: `src/app.ts` (Hono routes), ingest, read API, `Store`
  interface.

## Data model

Reuse existing migrations nearly verbatim:
- `events` table (flat columns + indexes as shipped).
- `is_archived` column retained but exposed only through the neutral
  `/api/records/visibility` API (Active = not hidden, Disabled =
  hidden). Disabled ≠ deleted.

Migrations run automatically on container startup (schema-version check
→ apply pending `.sql` in order). No separate migrate step for the
container path. Cloudflare path applies via wrangler as today.

## Deployment artifacts

1. **Dockerfile + docker-compose.yml** (universal baseline) — image +
   named volume for SQLite. Runs on any container host / local / VPS.
2. **Fly.io** (`fly.toml` + volume) — flagship always-on + volume
   example (~$3-5/mo, one-command deploy).
3. **Cloudflare** (slimmed `wrangler.toml`) — D1 binding, static
   assets, `WEBHOOK_TOKEN`; **no** Durable Objects / DO-migration block.
   Uses `D1Store` + `src/worker.ts`.

Each path gets its own clear, self-contained deploy guide so a customer
follows exactly one lane end to end.

## Configuration

| Var | Purpose | Required |
|-----|---------|----------|
| `WEBHOOK_TOKEN` | Shared webhook auth secret | Yes (all paths) |
| `APP_TITLE` | Dashboard title | No |
| `LOGO_URL` | Custom logo | No |
| `DB_PATH` | SQLite file path (container path) | No (default to volume mount) |

`WEBHOOK_TOKEN` remains mandatory on every path; deploy guides show how
to set it per environment.

## Error handling

- Missing/blank `WEBHOOK_TOKEN` → startup fails clearly (container) /
  request fails clearly (Workers).
- Unauthorized webhook → `401`, constant-time compare.
- Malformed webhook payload → `400` with a terse reason; never crashes
  ingest.
- Storage unavailable → `/api/health` reports `degraded`; API returns
  `503`; SPA shows an AlertBanner.

## Testing strategy

- **Store adapters**: unit tests against `SqliteStore` (in-memory /
  temp file) covering insert/upsert identity, filters, stats,
  visibility.
- **Ingest**: table-driven tests over real Setup Manager payload shapes
  (Started, Finished, failed actions) → asserts derived columns and
  enrollment collapse.
- **API**: integration tests hitting the Hono `app` in-process for each
  endpoint incl. `304`/`since` conditional behavior.
- **Auth**: token compare (valid/invalid/empty/timing).
- **End-to-end smoke**: reuse `scripts/send-test-events.sh` against a
  locally running container; assert `/api/stats` reflects sent events.
- **Frontend**: component-level tests for `useEvents()` poll/backoff
  logic; manual browser verification of the dashboard views.

## Out of scope (YAGNI)

- Per-cloud serverless function adapters.
- Auth UI (dashboard protection stays a deployment concern: reverse
  proxy / platform auth / optional token).
- User settings persistence, data export, theming beyond existing
  light/dark assets.
- WebSocket / SSE real-time.
