import { createApp } from './app.js';
import { D1Store } from './store/d1-store.js';

export interface Env {
  DB: any; // D1Database (from @cloudflare/workers-types at build time)
  WEBHOOK_TOKEN: string;
  APP_TITLE?: string;
  LOGO_URL?: string;
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const token = (env.WEBHOOK_TOKEN ?? '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'WEBHOOK_TOKEN not configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
    const url = new URL(request.url);
    const isApi = url.pathname.startsWith('/api') || url.pathname === '/webhook';
    if (!isApi && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    const store = new D1Store(env.DB);
    const app = createApp(store, { token, appTitle: env.APP_TITLE, logoUrl: env.LOGO_URL });
    return app.fetch(request);
  },
};
