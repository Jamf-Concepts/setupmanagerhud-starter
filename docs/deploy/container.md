# Deploy: Docker / docker-compose

Self-contained lane using the included `Dockerfile` and `docker-compose.yml`. Runs on any host with Docker Engine installed.

## Prerequisites

- Docker Engine 24+ (or Docker Desktop)
- The `docker compose` CLI plugin

## 1. Generate a webhook token

```bash
openssl rand -hex 24
```

Save the output — you will set the same value in Setup Manager.

## 2. Start the stack

```bash
WEBHOOK_TOKEN=<your-token> docker compose up --build
```

The first run builds the image (installs deps, compiles the frontend). Subsequent starts reuse the cached image unless you pass `--build` again.

The dashboard is available at `http://localhost:8080`.

Optional environment variables (pass in the same way):

| Variable | Default | Purpose |
|---|---|---|
| `APP_TITLE` | `Setup Manager HUD` | Title shown in the nav bar |
| `LOGO_URL` | _(none)_ | URL to a logo image for the nav bar |

## 3. Configure Setup Manager

In Setup Manager, set the webhook URL to:

```
http://<HOST>:8080/webhook
```

Use the same token you generated in step 1.

## 4. Verify

```bash
curl http://localhost:8080/api/health
# {"status":"ok","db":"ok"}
```

## Persistence

The SQLite database is stored in a named Docker volume (`hud-data`). It survives container restarts and image rebuilds.

```bash
# List volumes
docker volume ls

# Backup the database
docker run --rm -v hud-data:/data -v "$PWD":/out busybox cp /data/hud.sqlite /out/hud-backup.sqlite
```

## Dashboard protection

The server has no built-in authentication for the dashboard UI. Protect it with a reverse proxy (nginx, Caddy, Traefik) or place it behind a VPN/firewall.
