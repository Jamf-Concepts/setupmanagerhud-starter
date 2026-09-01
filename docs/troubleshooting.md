# Troubleshooting

Common issues and how to fix them. Each section describes the symptom, the likely cause, and the steps to resolve it.

Examples use `YOUR-DASHBOARD-URL` as a placeholder. Replace it with your actual dashboard URL.

---

## Webhook Issues

### Webhooks return 401 Unauthorized

**Symptom:** Setup Manager devices get 401 errors. The dashboard receives no events.

**Cause:** The `WEBHOOK_TOKEN` in Setup Manager doesn't exactly match the one configured in your deployment.

**Fix:**

1. Confirm your deployment has `WEBHOOK_TOKEN` set:

   **Docker:** Check the environment — run `docker compose ps` and verify the container is running with the token set. Restart with `WEBHOOK_TOKEN=your-token docker compose up`.

   **Fly.io:**
   ```bash
   fly secrets list
   # Should show WEBHOOK_TOKEN in the list
   ```

   **Cloudflare Workers:**
   ```bash
   npx wrangler secret list
   # Should show WEBHOOK_TOKEN
   ```

2. If it's missing, set it:

   **Fly.io:** `fly secrets set WEBHOOK_TOKEN=your-token`  
   **Cloudflare:** `npx wrangler secret put WEBHOOK_TOKEN`

3. Check your Setup Manager plist. The `token` value must be exactly the same string — same capitalisation, no extra spaces, no line breaks.

4. Test manually to isolate the issue (replace the URL and token):

   ```bash
   curl -X POST https://YOUR-DASHBOARD-URL/webhook \
     -H "Authorization: Bearer your-token-here" \
     -H "Content-Type: application/json" \
     -d '{"name":"Started","event":"com.jamf.setupmanager.started","timestamp":"2025-01-01T00:00:00Z","started":"2025-01-01T00:00:00Z","modelName":"Test Mac","modelIdentifier":"Mac15,3","macOSBuild":"24A335","macOSVersion":"15.0","serialNumber":"TEST001","setupManagerVersion":"2.0.0"}'
   ```

   - **200 OK** — token is correct. If Setup Manager still fails, the plist token doesn't match.
   - **401** — the token you used in the curl is wrong. Fix the deployment token and redeploy.

---

### Webhooks return 503 Service Unavailable

**Symptom:** Webhook POST requests return a 503 error.

**Cause:** The database is not reachable.

**Fix:**

1. Check the health endpoint:
   ```bash
   curl https://YOUR-DASHBOARD-URL/api/health
   ```

2. If `"db"` is not `"ok"`, the database needs attention:

   **Docker:** Confirm the `hud-data` volume is mounted. Run `docker compose down` then `docker compose up` again with `WEBHOOK_TOKEN` set.

   **Fly.io:** Confirm the volume exists: `fly volumes list`. If the volume is missing, create it: `fly volumes create hud_data --size 1` then redeploy: `fly deploy`.

   **Cloudflare Workers:** Confirm the D1 database exists and its ID is in `wrangler.toml`. Run `wrangler d1 list` to see your databases. Apply migrations if you haven't: `wrangler d1 migrations apply DB --remote`. Then redeploy: `npm run deploy:cf`.

---

### Events aren't appearing on the dashboard

**Symptom:** Webhooks return 200 OK but the dashboard stays empty.

**Cause and fix — work through this checklist:**

1. **Confirm the event was actually stored.** Call the events API directly:
   ```bash
   curl https://YOUR-DASHBOARD-URL/api/events
   ```
   If you see events in the JSON response but not the dashboard, it's a browser issue — try a hard refresh (Cmd+Shift+R on Mac).

2. **Check the health endpoint.** The database must be `"ok"`:
   ```bash
   curl https://YOUR-DASHBOARD-URL/api/health
   ```

3. **Check your webhook payload.** The `serialNumber` and `started` fields are required. A missing field causes a `400 Bad Request` (not a 200).

4. **Wait a moment.** The dashboard polls for new events every few seconds. If you just sent a webhook, give it 5–10 seconds and check again.

---

## Dashboard Issues

### Dashboard won't load / blank page

**Symptom:** Opening the dashboard URL shows a blank page or a browser error.

**Fix:**

**Docker:** Confirm the container is running — `docker compose ps` should show it as `Up`. Check logs: `docker compose logs hud`.

**Fly.io:** Check the app is running — `fly status`. View logs: `fly logs`.

**Cloudflare Workers:** Open the Cloudflare dashboard, go to Workers & Pages, and check that the Worker deployed successfully. Look at the deployment logs for errors.

---

### Dashboard shows "Service Degraded" or "Service Warning" banner

**Symptom:** The dashboard loads but shows a warning banner at the top.

**Cause:** The health check reported the database as degraded.

**Fix:** Run `curl https://YOUR-DASHBOARD-URL/api/health` and check the `db` field. Then follow the database troubleshooting steps above for your deployment option.

---

### Disable / Enable button does nothing or shows an error

**Symptom:** Clicking **Disable** or **Enable** on an enrollment row appears to fail.

**Fix:**

1. Open the browser's developer console (in Chrome: View → Developer → JavaScript Console) and look for error messages.
2. Hard refresh the page (Cmd+Shift+R on Mac) to clear any cached JavaScript.
3. Check the health endpoint to confirm the database is reachable.

---

## Fly.io Issues

### App goes to sleep and data is lost

**Symptom:** The Fly.io app stopped and the database is gone.

**Cause:** This should not happen with the default `fly.toml` — it sets `auto_stop_machines = false` and `min_machines_running = 1`. If data was lost, the volume may have been deleted separately.

**Fix:**

1. Check the volume still exists: `fly volumes list`
2. If the volume is missing, you'll need to create a new one and redeploy (data recovery is not possible without a backup).
3. Confirm your `fly.toml` has the always-on settings:
   ```toml
   [http_service]
     auto_stop_machines = false
     min_machines_running = 1
   ```
4. Redeploy if the settings were wrong: `fly deploy`

---

### fly deploy fails: "No machines found"

**Symptom:** `fly deploy` reports an error about no machines.

**Fix:** This happens on a brand-new app before any machines exist. Run `fly launch --no-deploy` first to create the app configuration, then create your volume, set secrets, and run `fly deploy`. See [Fly.io deploy guide](deploy/fly.md) for the full sequence.

---

## Cloudflare Workers Issues

### Workers deploy fails: database ID not found

**Symptom:** `npm run deploy:cf` fails with an error about the D1 database.

**Fix:**

1. Create the database if you haven't: `wrangler d1 create setupmanagerhud-events`
2. Copy the `database_id` UUID from the output
3. Paste it into `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "setupmanagerhud-events"
   database_id = "paste-uuid-here"
   ```
4. Redeploy: `npm run deploy:cf`

---

### Local development: `wrangler dev` doesn't show events

**Symptom:** You run `wrangler dev` but the local dashboard doesn't receive events.

**Fix:**

1. Make sure `.dev.vars` exists with your local token:
   ```
   WEBHOOK_TOKEN=local-test-token
   ```
2. Build the frontend first: `npm run build:frontend`
3. Send test events to `http://localhost:8787/webhook` (not your production URL) with the local token.

---

## General

### Need to start fresh

If you want to wipe all stored enrollments and start over:

**Docker:** `docker compose down -v` removes the container and the data volume. Then bring it back up.

**Fly.io:** You can delete and recreate the volume, but this is destructive and permanent:
```bash
fly volumes list
fly volumes delete vol_xxxx  # replace with your volume ID
fly volumes create hud_data --size 1
fly deploy
```

**Cloudflare D1:** Delete and recreate the database in the Cloudflare dashboard (Workers & Pages → D1 → your database → Delete), then re-run `npm run deploy:cf`.

---

### Need more help?

Check the [GitHub Issues](https://github.com/Jamf-Concepts/setupmanagerhud-starter/issues) for similar problems, or open a new issue with:
- Which deployment option you're using (Docker / Fly.io / Cloudflare)
- The output of `curl https://YOUR-DASHBOARD-URL/api/health`
- Any error messages from your deployment logs
