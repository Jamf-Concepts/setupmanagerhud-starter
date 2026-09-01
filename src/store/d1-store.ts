import type {
  Store, EventRecord, EventFilters, Stats, HealthResult,
} from './store.js';

interface D1Result<T = unknown> { results: T[]; }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

function mapRow(row: any): EventRecord {
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

export class D1Store implements Store {
  constructor(private db: D1DatabaseLike) {}

  migrate(): void { /* applied by wrangler d1 migrations apply */ }

  async insertOrUpdateEvent(r: EventRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO events (
        event_id, event_type, name, timestamp, payload_json, serial_number,
        model_name, model_identifier, macos_version, macos_build,
        setup_manager_version, started_at, finished_at, duration_seconds,
        computer_name, download_throughput, upload_throughput,
        failed_action_count, total_action_count, has_failed_actions, is_archived
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
    `).bind(
      r.eventId, r.eventType, r.name, r.timestamp, r.payloadJson, r.serialNumber,
      r.modelName, r.modelIdentifier, r.macosVersion, r.macosBuild,
      r.setupManagerVersion, r.startedAt, r.finishedAt, r.durationSeconds,
      r.computerName, r.downloadThroughput, r.uploadThroughput,
      r.failedActionCount, r.totalActionCount, r.hasFailedActions ? 1 : 0,
      r.isArchived ? 1 : 0,
    ).run();
  }

  private buildWhere(f: EventFilters): { clause: string; params: unknown[] } {
    const conds: string[] = [];
    const params: unknown[] = [];
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
    return { clause: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
  }

  async queryEvents(f: EventFilters): Promise<EventRecord[]> {
    const { clause, params } = this.buildWhere(f);
    const limit = Math.min(f.limit ?? 200, 1000);
    const offset = f.offset ?? 0;
    const res = await this.db.prepare(
      `SELECT * FROM events ${clause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    ).bind(...params, limit, offset).all();
    return res.results.map(mapRow);
  }

  async latestTimestamp(): Promise<string | null> {
    const row: any = await this.db.prepare('SELECT MAX(timestamp) AS ts FROM events').bind().first();
    return row?.ts ?? null;
  }

  async stats(f: EventFilters): Promise<Stats> {
    const { clause, params } = this.buildWhere({ ...f, failedOnly: false });
    const row: any = await this.db.prepare(`
      SELECT COUNT(*) AS total, SUM(has_failed_actions) AS failed,
             AVG(duration_seconds) AS avg_dur, AVG(download_throughput) AS avg_down,
             AVG(upload_throughput) AS avg_up
      FROM events ${clause}
    `).bind(...params).first();
    const total = row?.total ?? 0;
    const failed = row?.failed ?? 0;
    return {
      totalEnrollments: total,
      failedEnrollments: failed,
      failureRate: total > 0 ? failed / total : 0,
      avgDurationSeconds: row?.avg_dur ?? null,
      avgDownloadThroughput: row?.avg_down ?? null,
      avgUploadThroughput: row?.avg_up ?? null,
    };
  }

  async records(state: 'active' | 'hidden'): Promise<EventRecord[]> {
    const archived = state === 'hidden' ? 1 : 0;
    const res = await this.db.prepare(
      'SELECT * FROM events WHERE is_archived = ? ORDER BY timestamp DESC',
    ).bind(archived).all();
    return res.results.map(mapRow);
  }

  async setVisibility(eventId: string, hidden: boolean): Promise<void> {
    await this.db.prepare('UPDATE events SET is_archived = ? WHERE event_id = ?')
      .bind(hidden ? 1 : 0, eventId).run();
  }

  async health(): Promise<HealthResult> {
    try {
      await this.db.prepare('SELECT 1').bind().first();
      return { status: 'ok', db: 'connected' };
    } catch {
      return { status: 'degraded', db: 'disconnected' };
    }
  }
}
