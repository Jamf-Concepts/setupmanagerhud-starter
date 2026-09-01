# Security

> [!WARNING]
> **Webhook tokens are required for every deployment.**
> Without a token, anyone who discovers your dashboard URL can POST fake enrollment events to your dashboard.

## Webhook Token (Required)

`WEBHOOK_TOKEN` is the shared secret between Setup Manager and your dashboard. Every webhook POST from Setup Manager includes this token, and the dashboard checks it on every request. A missing or blank token causes the container to refuse to start (Docker/Fly.io) or every request to return `401 Unauthorized` (Cloudflare Workers).

See [Configuration](configuration.md) for how to generate a token and set it in each deployment option.

---

## Protecting the Dashboard (Optional)

The dashboard routes (`/`, `/api/*`) are public to anyone who knows your URL. The `/webhook` endpoint must always be reachable by Setup Manager devices, but the dashboard itself is just an HTML page — anyone with the URL can see enrollment data.

If you want to restrict who can view the dashboard, use a layer of authentication in front of it:

### Docker / Fly.io — Reverse Proxy

Put a reverse proxy (nginx, Caddy, Traefik, or similar) in front of the container and add basic auth or OAuth. The proxy must allow unauthenticated POST requests to `/webhook` — that path is protected by `WEBHOOK_TOKEN` only.

Example with Caddy basic auth:

```
your-domain.example.com {
    basicauth /* {
        admin JDJhJDE0JHF...  # bcrypt hash from caddy hash-password
    }
    # Allow webhook without basic auth
    @webhook path /webhook
    handle @webhook {
        reverse_proxy localhost:8080
    }
    handle {
        reverse_proxy localhost:8080
    }
}
```

### Cloudflare Workers — Cloudflare Access

Cloudflare Access sits at Cloudflare's edge before requests reach your Worker. It adds an authentication step for dashboard routes while letting `/webhook` through without requiring a login.

**Quick setup:**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Zero Trust → Enable → choose a team name → Free plan
2. Go to **Integrations → Identity providers** → add **One-time PIN** (simplest option, sends codes via email) or your existing provider (Google, Microsoft, Okta, etc.)
3. Go to **Access → Applications → Add an application → Self-hosted**
   - Name: `Setup Manager HUD`
   - Domain: your Worker URL (e.g. `setupmanagerhud.workers.dev`)
4. Create an **Allow** policy — add your email address or your org's email domain
5. Create a **Bypass** policy for the webhook path:
   - Policy name: `Bypass webhook`
   - Action: **Bypass**
   - Include: **Everyone**
   - Path: `/webhook`
   - Move this policy **above** the Allow policy

With this in place, visiting the dashboard prompts users to authenticate, but Setup Manager devices can still POST to `/webhook` without any login.

**Optional: validate Access JWTs inside the Worker**

By default, Access validates tokens at the edge. For an extra layer, you can configure the Worker to also check the Cloudflare Access JWT on every dashboard/API request. Add these to `wrangler.toml`:

```toml
[vars]
CF_ACCESS_AUD = "paste-your-audience-tag-here"
CF_ACCESS_TEAM_DOMAIN = "your-team.cloudflareaccess.com"
```

Find the Audience tag: Zero Trust → Access → Applications → open your application → Application Audience (AUD) Tag.

Redeploy after adding these values: `npm run deploy:cf`

---

## Rate Limiting (Optional)

To prevent webhook flooding — for example, if a device gets into a retry loop — add a rate limiting rule at your edge:

**Cloudflare WAF (Workers deployment):**

1. Cloudflare dashboard → Security → WAF → Rate limiting rules
2. Create a rule:
   - Match: URI Path equals `/webhook`
   - Rate: 30 requests per minute per IP (adjust for fleet size)
   - Action: Block for 1 minute

| Fleet Size | Concurrent Enrollments | Suggested Rate |
|------------|----------------------|----------------|
| Small (≤10 devices) | 1–10 | 30 req/min |
| Medium (10–50 devices) | 10–50 | 120 req/min |
| Large (50+ from one IP) | 50+ | 300 req/min |

Each device sends 2 webhooks per enrollment (started + finished). If devices share a NAT gateway, base the limit on expected concurrent enrollments.

**Docker / Fly.io:** configure rate limiting in your reverse proxy or at your firewall/load balancer.

---

## Route Summary

| Route | Who can access |
|-------|---------------|
| `/` (dashboard) | Anyone with the URL (or restricted by reverse proxy / Cloudflare Access if configured) |
| `/api/*` | Anyone with the URL (same as above) |
| `/webhook` | Anyone with the URL, but requests are rejected unless `Authorization: Bearer <WEBHOOK_TOKEN>` matches |
