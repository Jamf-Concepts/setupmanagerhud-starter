import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { D1Store } from '../../src/store/d1-store.js';
import type { EventRecord } from '../../src/store/store.js';

// Minimal D1Database shim backed by better-sqlite3, matching the subset
// of the D1 API that D1Store uses: prepare().bind().all()/.first()/.run().
function makeD1(): any {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE events (
      event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, name TEXT NOT NULL,
      timestamp TEXT NOT NULL, payload_json TEXT NOT NULL, serial_number TEXT,
      model_name TEXT, model_identifier TEXT, macos_version TEXT, macos_build TEXT,
      setup_manager_version TEXT, started_at TEXT, finished_at TEXT,
      duration_seconds INTEGER, computer_name TEXT, download_throughput INTEGER,
      upload_throughput INTEGER, failed_action_count INTEGER NOT NULL DEFAULT 0,
      total_action_count INTEGER NOT NULL DEFAULT 0,
      has_failed_actions INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0
    );
  `);
  return {
    prepare(sql: string) {
      let params: any[] = [];
      const stmt = {
        bind(...args: any[]) { params = args; return stmt; },
        all() { return Promise.resolve({ results: db.prepare(sql).all(...params) }); },
        first() { return Promise.resolve(db.prepare(sql).get(...params) ?? null); },
        run() { db.prepare(sql).run(...params); return Promise.resolve({ success: true }); },
      };
      return stmt;
    },
  };
}

function rec(over: Partial<EventRecord>): EventRecord {
  return {
    eventId: 'ABC123|2026-08-31T10:00:00Z', eventType: 'started', name: 'Started',
    timestamp: '2026-08-31T10:00:00Z', serialNumber: 'ABC123', modelName: 'MBP',
    modelIdentifier: 'Mac15,3', macosVersion: '26.2', macosBuild: '25C57',
    setupManagerVersion: '2.0.0', startedAt: '2026-08-31T10:00:00Z', finishedAt: null,
    durationSeconds: null, computerName: null, downloadThroughput: null,
    uploadThroughput: null, failedActionCount: 0, totalActionCount: 0,
    hasFailedActions: false, isArchived: false, payloadJson: '{}', ...over,
  };
}

describe('D1Store', () => {
  it('inserts and reads back', async () => {
    const s = new D1Store(makeD1());
    await s.insertOrUpdateEvent(rec({}));
    const events = await s.queryEvents({});
    expect(events).toHaveLength(1);
    expect(events[0]!.serialNumber).toBe('ABC123');
  });

  it('upserts Finished onto the same enrollment id', async () => {
    const s = new D1Store(makeD1());
    const id = 'ABC123|2026-08-31T10:00:00Z';
    await s.insertOrUpdateEvent(rec({ eventId: id }));
    await s.insertOrUpdateEvent(rec({ eventId: id, name: 'Finished', finishedAt: '2026-08-31T10:05:00Z', hasFailedActions: true, failedActionCount: 1, totalActionCount: 3 }));
    const events = await s.queryEvents({});
    expect(events).toHaveLength(1);
    expect(events[0]!.hasFailedActions).toBe(true);
  });

  it('toggles visibility', async () => {
    const s = new D1Store(makeD1());
    await s.insertOrUpdateEvent(rec({ eventId: 'A|1' }));
    await s.setVisibility('A|1', true);
    expect(await s.records('active')).toHaveLength(0);
    expect(await s.records('hidden')).toHaveLength(1);
  });

  it('computes latestTimestamp and stats', async () => {
    const s = new D1Store(makeD1());
    await s.insertOrUpdateEvent(rec({ eventId: 'A|1', timestamp: '2026-08-31T10:00:00Z', durationSeconds: 100 }));
    await s.insertOrUpdateEvent(rec({ eventId: 'B|1', timestamp: '2026-08-31T12:00:00Z', durationSeconds: 300, hasFailedActions: true, failedActionCount: 1 }));
    expect(await s.latestTimestamp()).toBe('2026-08-31T12:00:00Z');
    const st = await s.stats({});
    expect(st.totalEnrollments).toBe(2);
    expect(st.failedEnrollments).toBe(1);
  });
});
