# Configuration Reference

This page covers all the configuration options for Setup Manager HUD. For first-time setup, start with [Getting Started](getting-started.md) and your [deploy guide](../README.md#deploy-guides).

---

## Required: Webhook Token

`WEBHOOK_TOKEN` is the shared secret between Setup Manager and your dashboard. Every webhook request from Setup Manager must include this token, and your dashboard checks it on every inbound request.

**Generate one:**

```bash
openssl rand -hex 24
```

**Set it in your deployment:**

| Deploy option | How to set it |
|---------------|--------------|
| Docker / docker-compose | `WEBHOOK_TOKEN=your-token docker compose up` |
| Fly.io | `fly secrets set WEBHOOK_TOKEN=your-token` |
| Cloudflare Workers | `npx wrangler secret put WEBHOOK_TOKEN` |

**What happens if it's missing or wrong:**
- Container (Docker/Fly.io): the server refuses to start
- Cloudflare Workers: every request returns `401 Unauthorized`
- Setup Manager: enrollment events fail to reach the dashboard

If you lose the token, generate a new one and update both sides: your deployment and your Setup Manager webhook plist.

---

## Optional: Dashboard Customisation

These are optional. The dashboard works fine without them.

| Variable | Purpose | Default |
|----------|---------|---------|
| `APP_TITLE` | Title shown in the top navigation bar | `Setup Manager HUD` |
| `LOGO_URL` | URL to a logo image shown next to the title | _(none)_ |

**Set them by deploy option:**

**Docker / docker-compose** — add to your environment variables:

```bash
APP_TITLE="Acme Corp Enrollments" WEBHOOK_TOKEN=your-token docker compose up
```

Or in a `.env` file next to `docker-compose.yml`:

```
WEBHOOK_TOKEN=your-token
APP_TITLE=Acme Corp Enrollments
LOGO_URL=https://example.com/logo.png
```

**Fly.io** — set as secrets (they are encrypted at rest):

```bash
fly secrets set APP_TITLE="Acme Corp Enrollments"
fly secrets set LOGO_URL="https://example.com/logo.png"
```

**Cloudflare Workers** — add to the `[vars]` section of `wrangler.toml` and redeploy:

```toml
[vars]
APP_TITLE = "Acme Corp Enrollments"
LOGO_URL = "https://example.com/logo.png"
```

```bash
npm run deploy:cf
```

---

## Storage Configuration

### Docker / Fly.io — SQLite on a volume

The database is a single file stored on a mounted volume. No database server required.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DB_PATH` | `/data/hud.sqlite` | Path to the SQLite database file |
| `PORT` | `8080` | Port the server listens on |

The default `DB_PATH` is correct for the Docker and Fly.io setups — the volume is mounted at `/data`. Only change it if you're running the server directly without Docker and want the database somewhere else.

**Docker:** the named volume `hud-data` is created automatically and mounted at `/data`. It persists across container restarts and image rebuilds.

**Fly.io:** the `hud_data` volume is created with `fly volumes create` and mounted at `/data`. It persists as long as the app exists.

### Cloudflare Workers — D1 (managed database)

Cloudflare D1 is a managed SQLite database that lives in Cloudflare's infrastructure. You don't manage files or backups — Cloudflare handles it.

The database is configured in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "setupmanagerhud-events"
database_id = "paste-your-d1-database-id-here"
```

- `database_name` — the name you chose when running `wrangler d1 create`
- `database_id` — the UUID Cloudflare assigned to your database (from the `wrangler d1 create` output)
- `binding = "DB"` — the internal name the code uses; do not change this

---

## Health Check

All three deployment options expose a health endpoint you can use to verify the deployment is running correctly:

```bash
curl https://YOUR-DASHBOARD-URL/api/health
```

A healthy response:

```json
{"status":"ok","db":"ok"}
```

A degraded response (database not reachable):

```json
{"status":"degraded","db":"disconnected"}
```

The endpoint returns HTTP 200 when healthy and HTTP 503 when degraded. If you see degraded, check [Troubleshooting](troubleshooting.md).

---

## API Reference

The dashboard uses these endpoints internally. You can also call them directly for automation or integration.

### Events

```
GET /api/events
```

Returns stored enrollment events. Supports filtering:

| Parameter | Values | Purpose |
|-----------|--------|---------|
| `limit` | 1–1000 | Max events to return (default 200) |
| `offset` | 0+ | Skip this many events (for pagination) |
| `eventType` | `com.jamf.setupmanager.started` or `com.jamf.setupmanager.finished` | Filter by event type |
| `failedOnly` | `true` | Only return enrollments with failed actions |
| `macOSVersion` | e.g. `15.0` | Filter by macOS version |
| `model` | e.g. `MacBook Pro` | Filter by model name |
| `serial` | e.g. `ABC123` | Filter by serial number |
| `search` | any text | Search serial, model, and computer name |

Example — get the 50 most recent failed enrollments:

```bash
curl "https://YOUR-DASHBOARD-URL/api/events?failedOnly=true&limit=50"
```

### Stats

```
GET /api/stats
```

Returns aggregate stats: total enrollments, failed count, failure rate, average duration, average download/upload throughput. Accepts the same filter parameters as `/api/events`.

### Config

```
GET /api/config
```

Returns the dashboard title and logo URL (from `APP_TITLE` and `LOGO_URL`).

### Record Visibility

```
GET  /api/records          → active enrollments
GET  /api/records?state=hidden → hidden enrollments
POST /api/records/visibility   → hide or show an enrollment
```

To hide an enrollment (moves it to the Disabled tab):

```bash
curl -X POST https://YOUR-DASHBOARD-URL/api/records/visibility \
  -H "Content-Type: application/json" \
  -d '{"eventId":"SERIAL|2025-01-01T00:00:00Z","hidden":true}'
```

To show it again, use `"hidden":false`. Hidden records are never deleted — they can always be re-enabled.

> [!NOTE]
> The `eventId` is the serial number and enrollment start time joined by `|`. It appears in the events API response as `eventId`.
