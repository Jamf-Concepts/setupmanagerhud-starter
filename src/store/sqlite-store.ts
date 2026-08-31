import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  Store, EventRecord, EventFilters, Stats, HealthResult,
} from './store.js';

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'migrations',
);

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  migrate(): void {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')))',
    );
    const applied = new Set(
      this.db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name),
    );
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      this.db.exec(sql);
      this.db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    }
  }

  insertOrUpdateEvent(r: EventRecord): void {
    this.db.prepare(`
      INSERT INTO events (
        event_id, event_type, name, timestamp, payload_json, serial_number,
        model_name, model_identifier, macos_version, macos_build,
        setup_manager_version, started_at, finished_at, duration_seconds,
        computer_name, download_throughput, upload_throughput,
        failed_action_count, total_action_count, has_failed_actions, is_archived
      ) VALUES (
        @eventId, @eventType, @name, @timestamp, @payloadJson, @serialNumber,
        @modelName, @modelIdentifier, @macosVersion, @macosBuild,
        @setupManagerVersion, @startedAt, @finishedAt, @durationSeconds,
        @computerName, @downloadThroughput, @uploadThroughput,
        @failedActionCount, @totalActionCount, @hasFailedActions, @isArchived
      )
      ON CONFLICT(event_id) DO UPDATE SET
        event_type = excluded.event_type,
        name = excluded.name,
        timestamp = excluded.timestamp,
        payload_json = excluded.payload_json,
        model_name = COALESCE(excluded.model_name, events.model_name),
        model_identifier = COALESCE(excluded.model_identifier, events.model_identifier),
        macos_version = COALESCE(excluded.macos_version, events.macos_version),
        macos_build = COALESCE(excluded.macos_build, events.macos_build),
        setup_manager_version = COALESCE(excluded.setup_manager_version, events.setup_manager_version),
        finished_at = COALESCE(excluded.finished_at, events.finished_at),
        duration_seconds = COALESCE(excluded.duration_seconds, events.duration_seconds),
        computer_name = COALESCE(excluded.computer_name, events.computer_name),
        download_throughput = COALESCE(excluded.download_throughput, events.download_throughput),
        upload_throughput = COALESCE(excluded.upload_throughput, events.upload_throughput),
        failed_action_count = excluded.failed_action_count,
        total_action_count = excluded.total_action_count,
        has_failed_actions = excluded.has_failed_actions
    `).run({
      ...r,
      hasFailedActions: r.hasFailedActions ? 1 : 0,
      isArchived: r.isArchived ? 1 : 0,
    });
  }

  private buildWhere(f: EventFilters): { clause: string; params: any[] } {
    const conds: string[] = [];
    const params: any[] = [];
    if (!f.includeArchived) conds.push('is_archived = 0');
    if (f.eventType) { conds.push('event_type = ?'); params.push(f.eventType); }
    if (f.failedOnly) conds.push('has_failed_actions = 1');
    if (f.macosVersion) { conds.push('macos_version = ?'); params.push(f.macosVersion); }
    if (f.model) { conds.push('model_name = ?'); params.push(f.model); }
    if (f.serial) { conds.push('serial_number = ?'); params.push(f.serial); }
    if (f.search) {
      conds.push('(serial_number LIKE ? OR computer_name LIKE ? OR model_name LIKE ?)');
      const like = `%${f.search}%`;
      params.push(like, like, like);
    }
    const clause = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return { clause, params };
  }

  private mapRow(row: any): EventRecord {
    return {
      eventId: row.event_id,
      eventType: row.event_type,
      name: row.name,
      timestamp: row.timestamp,
      serialNumber: row.serial_number,
      modelName: row.model_name,
      modelIdentifier: row.model_identifier,
      macosVersion: row.macos_version,
      macosBuild: row.macos_build,
      setupManagerVersion: row.setup_manager_version,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationSeconds: row.duration_seconds,
      computerName: row.computer_name,
      downloadThroughput: row.download_throughput,
      uploadThroughput: row.upload_throughput,
      failedActionCount: row.failed_action_count,
      totalActionCount: row.total_action_count,
      hasFailedActions: !!row.has_failed_actions,
      isArchived: !!row.is_archived,
      payloadJson: row.payload_json,
    };
  }

  queryEvents(f: EventFilters): EventRecord[] {
    const { clause, params } = this.buildWhere(f);
    const limit = Math.min(f.limit ?? 200, 1000);
    const offset = f.offset ?? 0;
    const rows = this.db.prepare(
      `SELECT * FROM events ${clause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset);
    return rows.map((r) => this.mapRow(r));
  }

  latestTimestamp(): string | null {
    const row: any = this.db.prepare('SELECT MAX(timestamp) AS ts FROM events').get();
    return row?.ts ?? null;
  }

  stats(f: EventFilters): Stats {
    const { clause, params } = this.buildWhere({ ...f, failedOnly: false });
    const row: any = this.db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(has_failed_actions) AS failed,
        AVG(duration_seconds) AS avg_dur,
        AVG(download_throughput) AS avg_down,
        AVG(upload_throughput) AS avg_up
      FROM events ${clause}
    `).get(...params);
    const total = row.total ?? 0;
    const failed = row.failed ?? 0;
    return {
      totalEnrollments: total,
      failedEnrollments: failed,
      failureRate: total > 0 ? failed / total : 0,
      avgDurationSeconds: row.avg_dur ?? null,
      avgDownloadThroughput: row.avg_down ?? null,
      avgUploadThroughput: row.avg_up ?? null,
    };
  }

  records(state: 'active' | 'hidden'): EventRecord[] {
    const archived = state === 'hidden' ? 1 : 0;
    const rows = this.db.prepare(
      'SELECT * FROM events WHERE is_archived = ? ORDER BY timestamp DESC',
    ).all(archived);
    return rows.map((r) => this.mapRow(r));
  }

  setVisibility(eventId: string, hidden: boolean): void {
    this.db.prepare('UPDATE events SET is_archived = ? WHERE event_id = ?')
      .run(hidden ? 1 : 0, eventId);
  }

  health(): HealthResult {
    try {
      this.db.prepare('SELECT 1').get();
      return { status: 'ok', db: 'connected' };
    } catch {
      return { status: 'degraded', db: 'disconnected' };
    }
  }
}
