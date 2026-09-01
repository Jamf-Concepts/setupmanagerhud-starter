import { Hono } from 'hono';
import type { Store, EventFilters } from './store/store.js';
import { verifyToken } from './ingest/auth.js';
import { parseWebhook, ParseError } from './ingest/parse.js';
import { etagFor, notModified } from './etag.js';

export interface AppConfig {
  token: string;
  appTitle?: string;
  logoUrl?: string;
}

function readFilters(url: URL): EventFilters {
  const q = url.searchParams;
  const n = (k: string): number | undefined => {
    const v = q.get(k);
    if (v === null) return undefined;
    const num = Number(v);
    return isNaN(num) ? undefined : num;
  };
  return {
    limit: n('limit'),
    offset: n('offset'),
    eventType: q.get('eventType') ?? undefined,
    failedOnly: q.get('failedOnly') === 'true',
    macosVersion: q.get('macOSVersion') ?? undefined,
    model: q.get('model') ?? undefined,
    serial: q.get('serial') ?? undefined,
    search: q.get('search') ?? undefined,
    timeRange: q.get('timeRange') ?? undefined,
  };
}

export function createApp(store: Store, config: AppConfig): Hono {
  const app = new Hono();

  app.post('/webhook', async (c) => {
    const header = c.req.header('Authorization') ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!verifyToken(provided, config.token)) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid JSON' }, 400);
    }
    try {
      const record = parseWebhook(body);
      await store.insertOrUpdateEvent(record);
      return c.json({ ok: true });
    } catch (err) {
      if (err instanceof ParseError) return c.json({ error: err.message }, 400);
      throw err;
    }
  });

  app.get('/api/events', async (c) => {
    const url = new URL(c.req.url);
    const latest = await store.latestTimestamp();
    const etag = etagFor(latest);
    if (notModified(c.req.raw, etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    const events = await store.queryEvents(readFilters(url));
    return c.json({ events, latest }, 200, { ETag: etag });
  });

  app.get('/api/stats', async (c) => {
    const url = new URL(c.req.url);
    return c.json(await store.stats(readFilters(url)));
  });

  app.get('/api/records', async (c) => {
    const state = c.req.query('state') === 'hidden' ? 'hidden' : 'active';
    return c.json({ records: await store.records(state) });
  });

  app.post('/api/records/visibility', async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid JSON' }, 400);
    }
    if (typeof body?.eventId !== 'string' || typeof body?.hidden !== 'boolean') {
      return c.json({ error: 'eventId (string) and hidden (boolean) required' }, 400);
    }
    await store.setVisibility(body.eventId, body.hidden);
    return c.json({ ok: true });
  });

  app.get('/api/config', (c) => {
    return c.json({ appTitle: config.appTitle ?? 'Setup Manager HUD', logoUrl: config.logoUrl ?? null });
  });

  app.get('/api/health', async (c) => {
    const h = await store.health();
    return c.json(h, h.status === 'ok' ? 200 : 503);
  });

  return app;
}
