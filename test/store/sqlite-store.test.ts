import { describe, it, expect } from 'vitest';
import { SqliteStore } from '../../src/store/sqlite-store.js';
import type { EventRecord } from '../../src/store/store.js';

function rec(over: Partial<EventRecord>): EventRecord {
  return {
    eventId: 'ABC123|2026-08-31T10:00:00Z',
    eventType: 'com.jamf.setupmanager.started',
    name: 'Started',
    timestamp: '2026-08-31T10:00:00Z',
    serialNumber: 'ABC123',
    modelName: 'MacBook Pro',
    modelIdentifier: 'Mac15,3',
    macosVersion: '26.2',
    macosBuild: '25C57',
    setupManagerVersion: '2.0.0',
    startedAt: '2026-08-31T10:00:00Z',
    finishedAt: null,
    durationSeconds: null,
    computerName: null,
    downloadThroughput: null,
    uploadThroughput: null,
    failedActionCount: 0,
    totalActionCount: 0,
    hasFailedActions: false,
    isArchived: false,
    payloadJson: '{}',
    ...over,
  };
}

describe('SqliteStore', () => {
  it('migrates and inserts then reads back', () => {
    const s = new SqliteStore(':memory:');
    s.insertOrUpdateEvent(rec({}));
    const events = s.queryEvents({});
    expect(events).toHaveLength(1);
    expect(events[0]!.serialNumber).toBe('ABC123');
  });

  it('upserts Finished onto the same enrollment id (collapse)', () => {
    const s = new SqliteStore(':memory:');
    const id = 'ABC123|2026-08-31T10:00:00Z';
    s.insertOrUpdateEvent(rec({ eventId: id }));
    s.insertOrUpdateEvent(rec({
      eventId: id,
      name: 'Finished',
      eventType: 'com.jamf.setupmanager.finished',
      finishedAt: '2026-08-31T10:05:00Z',
      durationSeconds: 300,
      totalActionCount: 3,
      failedActionCount: 1,
      hasFailedActions: true,
    }));
    const events = s.queryEvents({});
    expect(events).toHaveLength(1);
    expect(events[0]!.finishedAt).toBe('2026-08-31T10:05:00Z');
    expect(events[0]!.hasFailedActions).toBe(true);
  });

  it('filters failedOnly and by serial', () => {
    const s = new SqliteStore(':memory:');
    s.insertOrUpdateEvent(rec({ eventId: 'A|1', serialNumber: 'A', hasFailedActions: false }));
    s.insertOrUpdateEvent(rec({ eventId: 'B|1', serialNumber: 'B', hasFailedActions: true, failedActionCount: 1 }));
    expect(s.queryEvents({ failedOnly: true })).toHaveLength(1);
    expect(s.queryEvents({ serial: 'A' })).toHaveLength(1);
  });

  it('computes stats', () => {
    const s = new SqliteStore(':memory:');
    s.insertOrUpdateEvent(rec({ eventId: 'A|1', durationSeconds: 100, hasFailedActions: false }));
    s.insertOrUpdateEvent(rec({ eventId: 'B|1', durationSeconds: 300, hasFailedActions: true, failedActionCount: 1 }));
    const st = s.stats({});
    expect(st.totalEnrollments).toBe(2);
    expect(st.failedEnrollments).toBe(1);
    expect(st.failureRate).toBeCloseTo(0.5);
    expect(st.avgDurationSeconds).toBe(200);
  });

  it('visibility toggles active vs hidden records', () => {
    const s = new SqliteStore(':memory:');
    s.insertOrUpdateEvent(rec({ eventId: 'A|1' }));
    s.setVisibility('A|1', true);
    expect(s.records('active')).toHaveLength(0);
    expect(s.records('hidden')).toHaveLength(1);
    s.setVisibility('A|1', false);
    expect(s.records('active')).toHaveLength(1);
  });

  it('latestTimestamp returns max timestamp', () => {
    const s = new SqliteStore(':memory:');
    s.insertOrUpdateEvent(rec({ eventId: 'A|1', timestamp: '2026-08-31T10:00:00Z' }));
    s.insertOrUpdateEvent(rec({ eventId: 'B|1', timestamp: '2026-08-31T12:00:00Z' }));
    expect(s.latestTimestamp()).toBe('2026-08-31T12:00:00Z');
  });

  it('health reports connected', () => {
    const s = new SqliteStore(':memory:');
    expect(s.health().status).toBe('ok');
  });
});
