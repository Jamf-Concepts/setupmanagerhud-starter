# Getting Started

This guide walks you through deploying Setup Manager HUD and connecting it to Setup Manager — from nothing to a working dashboard.

**New here?** Start with the [main README](../README.md) to choose a deployment option, then come back here for the full walkthrough.

---

## Step 1: Choose Where to Deploy

Setup Manager HUD runs in three environments. Pick one:

| Option | What it means for you |
|--------|-----------------------|
| **Docker / docker-compose** | You run it on a server or Mac you control. Best if you already have a Linux server, a Mac Mini, or a VM running at your org. |
| **Fly.io** | A managed hosting service runs it for you. You don't need a server. Costs ~$3–5/month. |
| **Cloudflare Workers** | Cloudflare runs it serverlessly. No server, potentially free. Uses Cloudflare D1 for storage. |

Each option has its own deploy guide:
- [Docker / docker-compose](deploy/container.md)
- [Fly.io](deploy/fly.md)
- [Cloudflare Workers](deploy/cloudflare.md)

---

## Step 2: Generate a Webhook Token

Before you deploy anything, generate a secret token. This is how Setup Manager proves to the dashboard that webhook events are legitimate — not from someone else on the internet.

Run this in Terminal on your Mac:

```bash
openssl rand -hex 24
```

You'll get something like:

```
a3f8c2d1e4b7a0f6c9e2d5b8a1f4c7e0d3b6a9f
```

**Save this value in a password manager or secure note.** You'll need it in two places:
1. When you deploy the dashboard (as the `WEBHOOK_TOKEN`)
2. When you configure Setup Manager (as the `token` value in the plist)

If you lose it, you can generate a new one and update both sides — it just requires a brief re-configuration.

---

## Step 3: Deploy

Follow the guide for your chosen option:

- **[Docker / docker-compose](deploy/container.md)** — You'll paste the token as `WEBHOOK_TOKEN` when starting the container.
- **[Fly.io](deploy/fly.md)** — You'll use `fly secrets set WEBHOOK_TOKEN=...` to store the token securely.
- **[Cloudflare Workers](deploy/cloudflare.md)** — You'll use `wrangler secret put WEBHOOK_TOKEN` to store the token.

After deploying, you'll have a URL for your dashboard. It will look something like:
- Docker: `http://your-server-ip:8080`
- Fly.io: `https://setupmanagerhud.fly.dev`
- Cloudflare: `https://setupmanagerhud.your-subdomain.workers.dev`

---

## Step 4: Verify the Dashboard Is Up

Open the health URL in your browser or Terminal. Replace `YOUR-DASHBOARD-URL` with your actual URL:

```bash
curl https://YOUR-DASHBOARD-URL/api/health
```

A working dashboard responds:

```json
{"status":"ok","db":"ok"}
```

If you see an error instead, check [Troubleshooting](troubleshooting.md).

---

## Step 5: Configure Setup Manager

You need to tell Setup Manager to send webhook events to your dashboard. This is done in your Setup Manager configuration profile (a `.plist` file).

Add a `webhooks` section to your Setup Manager configuration. You need entries for both `started` (when enrollment begins) and `finished` (when it completes):

```xml
<key>webhooks</key>
<dict>
  <key>started</key>
  <dict>
    <key>url</key>
    <string>https://YOUR-DASHBOARD-URL/webhook</string>
    <key>token</key>
    <string>paste-your-webhook-token-here</string>
  </dict>
  <key>finished</key>
  <dict>
    <key>url</key>
    <string>https://YOUR-DASHBOARD-URL/webhook</string>
    <key>token</key>
    <string>paste-your-webhook-token-here</string>
  </dict>
</dict>
```

Replace:
- `YOUR-DASHBOARD-URL` — the URL from Step 3
- `paste-your-webhook-token-here` — the token you generated in Step 2

The `token` value must exactly match what you configured as `WEBHOOK_TOKEN` in your deployment. An extra space or different capitalization will cause 401 errors.

---

## Step 6: Send a Test Event

Before you wait for a real enrollment, send a test event from your Mac to confirm everything is connected:

```bash
curl -X POST https://YOUR-DASHBOARD-URL/webhook \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{"name":"Started","event":"com.jamf.setupmanager.started","timestamp":"2025-01-01T00:00:00Z","started":"2025-01-01T00:00:00Z","modelName":"Test Mac","modelIdentifier":"Mac15,3","macOSBuild":"24A335","macOSVersion":"15.0","serialNumber":"TEST001","setupManagerVersion":"2.0.0"}'
```

What the response means:
- **`{"ok":true}`** (HTTP 200) — Token matched. The test event was stored. Open the dashboard and you'll see it.
- **`{"error":"unauthorized"}`** (HTTP 401) — Token mismatch. Check that both sides have exactly the same `WEBHOOK_TOKEN` value.
- **`{"status":"degraded",...}`** (HTTP 503) — Database not reachable. See [Troubleshooting](troubleshooting.md).

---

## Step 7: Open the Dashboard

Open your dashboard URL in a browser. You should see the test event from Step 6 in the table.

The dashboard refreshes automatically every few seconds — you don't need to reload the page to see new events.

---

## Step 8: Clean Up Test Data

If you sent test events during setup and want to hide them before real enrollments start:

1. Find the test rows in the **Active** table
2. Click **Disable** on each one

Disabled rows move to the **Disabled** tab and are hidden from Active. They're not deleted — you can re-enable them any time. This is useful for hiding demo runs, test devices, or initial setup noise from your day-to-day view.

---

## What's Next?

- **Customise the title and logo** — set `APP_TITLE` and `LOGO_URL` in your deployment. See [Configuration](configuration.md).
- **Protect the dashboard** — add a reverse proxy with authentication in front of the Docker/Fly.io deployments, or use Cloudflare Access for the Workers deployment. The `/webhook` path must remain accessible to Setup Manager devices.
- **Troubleshoot issues** — see [Troubleshooting](troubleshooting.md).
