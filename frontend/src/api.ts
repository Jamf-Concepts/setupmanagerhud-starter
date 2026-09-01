export interface EventRow {
  eventId: string;
  name: string;
  eventType: string;
  timestamp: string;
  serialNumber: string;
  modelName: string | null;
  macosVersion: string | null;
  durationSeconds: number | null;
  hasFailedActions: boolean;
  failedActionCount: number;
  totalActionCount: number;
  isArchived: boolean;
}

export interface StatsResponse {
  totalEnrollments: number;
  failedEnrollments: number;
  failureRate: number;
  avgDurationSeconds: number | null;
  avgDownloadThroughput: number | null;
  avgUploadThroughput: number | null;
}

export interface EventsResponse { events: EventRow[]; latest: string | null; }

export async function fetchEvents(
  params: URLSearchParams, etag: string | null,
): Promise<{ status: number; etag: string | null; body: EventsResponse | null }> {
  const headers: HeadersInit = {};
  if (etag) headers['If-None-Match'] = etag;
  const res = await fetch(`/api/events?${params.toString()}`, { headers });
  if (res.status === 304) return { status: 304, etag, body: null };
  return { status: res.status, etag: res.headers.get('ETag'), body: await res.json() };
}

export async function fetchStats(params: URLSearchParams): Promise<StatsResponse> {
  return (await fetch(`/api/stats?${params.toString()}`)).json();
}

export async function fetchConfig(): Promise<{ appTitle: string; logoUrl: string | null }> {
  return (await fetch('/api/config')).json();
}

export async function fetchHealth(): Promise<{ status: string; db: string }> {
  return (await fetch('/api/health')).json();
}

export async function setVisibility(eventId: string, hidden: boolean): Promise<void> {
  await fetch('/api/records/visibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, hidden }),
  });
}
