export interface EnrollmentAction {
  label: string;
  status: string;
}

export interface EventRecord {
  eventId: string;
  eventType: string;
  name: string;
  timestamp: string;
  serialNumber: string;
  modelName: string | null;
  modelIdentifier: string | null;
  macosVersion: string | null;
  macosBuild: string | null;
  setupManagerVersion: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  computerName: string | null;
  downloadThroughput: number | null;
  uploadThroughput: number | null;
  failedActionCount: number;
  totalActionCount: number;
  hasFailedActions: boolean;
  isArchived: boolean;
  payloadJson: string;
}

export interface EventFilters {
  limit?: number;
  offset?: number;
  eventType?: string;
  failedOnly?: boolean;
  macosVersion?: string;
  model?: string;
  serial?: string;
  search?: string;
  timeRange?: string;
  includeArchived?: boolean;
}

export interface Stats {
  totalEnrollments: number;
  failedEnrollments: number;
  failureRate: number;
  avgDurationSeconds: number | null;
  avgDownloadThroughput: number | null;
  avgUploadThroughput: number | null;
}

export interface HealthResult {
  status: 'ok' | 'degraded';
  db: 'connected' | 'disconnected';
}

export interface Store {
  migrate(): Promise<void> | void;
  insertOrUpdateEvent(record: EventRecord): Promise<void> | void;
  queryEvents(filters: EventFilters): Promise<EventRecord[]> | EventRecord[];
  latestTimestamp(): Promise<string | null> | string | null;
  stats(filters: EventFilters): Promise<Stats> | Stats;
  records(state: 'active' | 'hidden'): Promise<EventRecord[]> | EventRecord[];
  setVisibility(eventId: string, hidden: boolean): Promise<void> | void;
  health(): Promise<HealthResult> | HealthResult;
}
