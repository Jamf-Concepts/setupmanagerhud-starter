import { describe, it, expect } from 'vitest';
import { verifyToken } from '../../src/ingest/auth.js';

describe('verifyToken', () => {
  it('accepts an exact match', () => {
    expect(verifyToken('secret-abc', 'secret-abc')).toBe(true);
  });
  it('rejects a wrong token', () => {
    expect(verifyToken('wrong', 'secret-abc')).toBe(false);
  });
  it('rejects null', () => {
    expect(verifyToken(null, 'secret-abc')).toBe(false);
  });
  it('rejects empty provided token', () => {
    expect(verifyToken('', 'secret-abc')).toBe(false);
  });
  it('rejects a different-length token without throwing', () => {
    expect(verifyToken('short', 'a-much-longer-secret-value')).toBe(false);
  });
});
