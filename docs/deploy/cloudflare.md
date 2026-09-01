# Deploy: Cloudflare Workers

Serverless lane using Cloudflare Workers + D1. No containers, no persistent machine costs. Real-time is replaced by adaptive client polling (the same as the container lane).

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated (`wrangler login`)
- Node 22+

## 1. Create the D1 database

```bash
wrangler d1 create setupmanagerhud-events
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "setupmanagerhud-events"
database_id = "<PASTE_ID_HERE>"
migrations_dir = "migrations"
```

## 2. Build the frontend

```bash
npm run build:frontend
```

This compiles the React SPA to `public/`. The `ASSETS` binding in `wrangler.toml` tells Workers to serve files from this directory.

## 3. Set the webhook token

```bash
npx wrangler secret put WEBHOOK_TOKEN
```

Enter a strong random value when prompted. Generate one with:

```bash
openssl rand -hex 24
```

Save it — you will configure the same value in Setup Manager.

## 4. Deploy

```bash
npm run deploy:cf
```

This runs `wrangler d1 migrations apply DB --remote` (applies any pending migrations) then `wrangler deploy`.

## 5. Configure Setup Manager

Set the webhook URL to:

```
https://<WORKER_SUBDOMAIN>.workers.dev/webhook
```

Use the same token from step 3.

## 6. Verify

```bash
curl https://<WORKER_SUBDOMAIN>.workers.dev/api/health
# {"status":"ok","db":"ok"}
```

## Notes

- **No Durable Objects.** This deployment has no WebSocket real-time; the dashboard polls via `?since=<ts>` with ETag / HTTP 304 backoff.
- **Static SPA** is served via the `ASSETS` binding — no separate Pages project needed.
- **Deploy Button.** `.dev.vars.example` contains `WEBHOOK_TOKEN=` so the Cloudflare Deploy Button prompts users for the token during one-click setup. Do not remove this file or the entry.

## Local development

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars and fill in WEBHOOK_TOKEN
npm run build:frontend
wrangler dev
```
