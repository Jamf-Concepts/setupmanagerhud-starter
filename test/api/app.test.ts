import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { SqliteStore } from '../../src/store/sqlite-store.js';

const TOKEN = 'test-token-123';

function makeApp() {
  const store = new SqliteStore(':memory:');
  const app = createApp(store, { token: TOKEN, appTitle: 'HUD', logoUrl: '/logo.svg' });
  return { store, app };
}

const startedBody = JSON.stringify({
  name: 'Started', event: 'com.jamf.setupmanager.started',
  timestamp: '2026-08-31T10:00:00Z', started: '2026-08-31T10:00:00Z',
  serialNumber: 'ABC123', modelName: 'MacBook Pro', macOSVersion: '26.2',
});

describe('createApp', () => {
  let app: ReturnType<typeof makeApp>['app'];
  beforeEach(() => { app = makeApp().app; });

  it('rejects webhook without token (401)', async () => {
    const res = await app.request('/webhook', { method: 'POST', body: startedBody });
    expect(res.status).toBe(401);
  });

  it('rejects malformed webhook payload (400)', async () => {
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Started' }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts a valid webhook (200) and lists it', async () => {
    const post = await app.request('/webhook', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: startedBody,
    });
    expect(post.status).toBe(200);
    const list = await app.request('/api/events');
    const json = await list.json();
    expect(json.events).toHaveLength(1);
  });

  it('returns 304 when If-None-Match matches current etag', async () => {
    await app.request('/webhook', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: startedBody,
    });
    const first = await app.request('/api/events');
    const etag = first.headers.get('ETag')!;
    expect(etag).toBeTruthy();
    const second = await app.request('/api/events', { headers: { 'If-None-Match': etag } });
    expect(second.status).toBe(304);
  });

  it('serves stats', async () => {
    const res = await app.request('/api/stats');
    const json = await res.json();
    expect(json).toHaveProperty('totalEnrollments');
  });

  it('serves config from AppConfig', async () => {
    const res = await app.request('/api/config');
    const json = await res.json();
    expect(json.appTitle).toBe('HUD');
    expect(json.logoUrl).toBe('/logo.svg');
  });

  it('health reports ok with connected db (no CF fields)', async () => {
    const res = await app.request('/api/health');
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.db).toBe('connected');
    expect(json).not.toHaveProperty('durable_objects');
    expect(json).not.toHaveProperty('connections');
  });

  it('toggles visibility via /api/records/visibility', async () => {
    await app.request('/webhook', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: startedBody,
    });
    const toggle = await app.request('/api/records/visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'ABC123|2026-08-31T10:00:00Z', hidden: true }),
    });
    expect(toggle.status).toBe(200);
    const hidden = await app.request('/api/records?state=hidden');
    expect((await hidden.json()).records).toHaveLength(1);
  });
});
