import { describe, it, expect } from 'vitest';
import { nextInterval } from './useEvents.js';

describe('nextInterval (adaptive backoff)', () => {
  it('polls fast right after activity', () => {
    expect(nextInterval({ changedLastPoll: true, current: 15000 })).toBe(3000);
  });
  it('backs off when idle, capped at 15s', () => {
    expect(nextInterval({ changedLastPoll: false, current: 3000 })).toBe(6000);
    expect(nextInterval({ changedLastPoll: false, current: 6000 })).toBe(12000);
    expect(nextInterval({ changedLastPoll: false, current: 12000 })).toBe(15000);
    expect(nextInterval({ changedLastPoll: false, current: 15000 })).toBe(15000);
  });
});
