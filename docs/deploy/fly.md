# Deploy: Fly.io

Always-on lane using Fly.io's persistent volumes for SQLite. `min_machines_running = 1` keeps one machine live at all times so the volume is never lost to scale-to-zero.

Estimated cost: ~$3–5/month (shared-cpu-1x, 256 MB RAM, 1 GB volume).

## Prerequisites

- [flyctl](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated (`fly auth login`)

## 1. Launch the app (no deploy yet)

```bash
fly launch --no-deploy
```

When prompted, accept the auto-detected config or adjust the region. Fly will create `fly.toml` if it does not already exist — this repo ships one with sensible defaults (`primary_region = "lhr"`). Edit it to change the region.

## 2. Create the persistent volume

```bash
fly volumes create hud_data --size 1
```

The `--size 1` flag allocates a 1 GB volume. The volume name must match `source = "hud_data"` in `fly.toml`.

## 3. Set the webhook token

```bash
fly secrets set WEBHOOK_TOKEN=$(openssl rand -hex 24)
```

Save the printed token — you will configure the same value in Setup Manager. You can retrieve the value at any time with `fly secrets list` (names only, not values).

## 4. Deploy

```bash
fly deploy
```

The first deploy builds and pushes the container image then starts the machine. Watch logs with:

```bash
fly logs
```

## 5. Configure Setup Manager

Set the webhook URL to:

```
https://<APP_NAME>.fly.dev/webhook
```

Use the same token from step 3.

## 6. Verify

```bash
curl https://<APP_NAME>.fly.dev/api/health
# {"status":"ok","db":"ok"}
```

## Always-on behaviour

`fly.toml` sets `auto_stop_machines = false` and `min_machines_running = 1`. This prevents Fly from suspending the machine when idle, which would cause SQLite data loss on scale-to-zero. Do not change these values without understanding the consequence.

## Backup

```bash
fly ssh console -C "sqlite3 /data/hud.sqlite .dump" > hud-backup.sql
```

## Custom domain

```bash
fly certs add yourdomain.example.com
```

Follow the DNS instructions printed by the command.
