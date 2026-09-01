import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApp, type AppConfig } from './app.js';
import { SqliteStore } from './store/sqlite-store.js';

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const token = (env.WEBHOOK_TOKEN ?? '').trim();
  if (!token) {
    throw new Error('WEBHOOK_TOKEN is required and must not be blank.');
  }
  return { token, appTitle: env.APP_TITLE, logoUrl: env.LOGO_URL };
}

function main(): void {
  const config = loadConfig(process.env);
  const dbPath = process.env.DB_PATH ?? '/data/hud.sqlite';
  const store = new SqliteStore(dbPath);
  const app = createApp(store, config);

  const publicDir = join(process.cwd(), 'public');
  app.use('/*', serveStatic({ root: './public' }));
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api') || c.req.path === '/webhook') return c.notFound();
    return c.html(readFileSync(join(publicDir, 'index.html'), 'utf8'));
  });

  const port = Number(process.env.PORT ?? 8080);
  serve({ fetch: app.fetch, port });
  // eslint-disable-next-line no-console
  console.log(`Setup Manager HUD listening on :${port} (db: ${dbPath})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
