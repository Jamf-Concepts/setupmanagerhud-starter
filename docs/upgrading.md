# Upgrading Setup Manager HUD

This guide covers how to pull in changes from the upstream `setupmanagerhud-starter` repository into your own deployment.

---

## How Upgrades Work

The dashboard is open source. When a new version is published, you pull the upstream changes into your copy of the repository, rebuild, and redeploy.

The upgrade path is the same regardless of deploy option (Docker, Fly.io, or Cloudflare Workers). The only difference is the final deploy step.

---

## Before You Upgrade

**Back up your data first.**

**Docker:** the database is in the `hud-data` Docker volume. If you want a copy:
```bash
docker run --rm -v hud-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/hud-backup-$(date +%Y%m%d).tar.gz /data
```

**Fly.io:** connect to your app and export the SQLite database:
```bash
fly ssh console -C "sqlite3 /data/hud.sqlite .dump" > hud-backup-$(date +%Y%m%d).sql
```

**Cloudflare D1:** export the remote database:
```bash
npx wrangler d1 export setupmanagerhud-events \
  --remote \
  --output hud-backup-$(date +%Y%m%d).sql
```

Do not commit backup files — they may contain serial numbers and enrollment history.

---

## Pull Upstream Changes

From inside your repository:

```bash
git remote add upstream https://github.com/Jamf-Concepts/setupmanagerhud-starter.git
git fetch upstream
git merge upstream/main
```

If you have a fork or have made local changes, resolve any merge conflicts before proceeding.

Install updated dependencies:

```bash
npm install
```

Rebuild the frontend:

```bash
npm run build:frontend
```

Run the test suite to confirm nothing is broken:

```bash
npm test
```

---

## Redeploy

**Docker:**

```bash
WEBHOOK_TOKEN=your-token docker compose up --build -d
```

The `--build` flag rebuilds the image. The volume (`hud-data`) is preserved across rebuilds.

**Fly.io:**

```bash
fly deploy
```

Fly.io uses the `fly.toml` and `Dockerfile` in your repository. The `hud_data` volume is preserved.

**Cloudflare Workers:**

Apply any new migrations first, then deploy:

```bash
npm run deploy:cf
```

`npm run deploy:cf` applies D1 migrations and deploys the Worker in one step.

---

## After Upgrading

Check the health endpoint to confirm the deployment is running:

```bash
curl https://YOUR-DASHBOARD-URL/api/health
```

A healthy response:

```json
{"status":"ok","db":"ok"}
```

If you see `"status":"degraded"`, check [Troubleshooting](troubleshooting.md).

---

## Troubleshooting

### Migrations fail on Cloudflare

If `npm run deploy:cf` fails with a migration error, check that your D1 database ID in `wrangler.toml` matches what Cloudflare has:

```bash
wrangler d1 list
```

Compare the `database_id` in `wrangler.toml` against the ID shown here.

### Docker container won't start after upgrade

Check the logs:

```bash
docker compose logs hud
```

A missing `WEBHOOK_TOKEN` will cause a clear startup failure. Confirm it's set:

```bash
docker compose ps
```

### Fly.io volume missing after upgrade

The volume should persist across deploys. If it was accidentally deleted:

```bash
fly volumes list
```

If the volume is gone, create a new one and redeploy (data from the old volume cannot be recovered):

```bash
fly volumes create hud_data --size 1
fly deploy
```
