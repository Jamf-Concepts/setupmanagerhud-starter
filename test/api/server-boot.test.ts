import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/server.js';

describe('loadConfig', () => {
  it('throws when WEBHOOK_TOKEN is missing', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/WEBHOOK_TOKEN/);
  });
  it('throws when WEBHOOK_TOKEN is blank', () => {
    expect(() => loadConfig({ WEBHOOK_TOKEN: '   ' } as NodeJS.ProcessEnv)).toThrow(/WEBHOOK_TOKEN/);
  });
  it('returns config with token and optional title/logo', () => {
    const cfg = loadConfig({ WEBHOOK_TOKEN: 'abc', APP_TITLE: 'My HUD', LOGO_URL: '/l.svg' } as any);
    expect(cfg.token).toBe('abc');
    expect(cfg.appTitle).toBe('My HUD');
    expect(cfg.logoUrl).toBe('/l.svg');
  });
});
