import type { EventRecord, EnrollmentAction } from '../store/store.js';

export class ParseError extends Error {}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function parseWebhook(body: unknown): EventRecord {
  if (typeof body !== 'object' || body === null) {
    throw new ParseError('body must be a JSON object');
  }
  const p = body as Record<string, unknown>;

  const serialNumber = str(p.serialNumber);
  if (!serialNumber) throw new ParseError('serialNumber is required');

  const started = str(p.started);
  if (!started) throw new ParseError('started is required');

  const actions: EnrollmentAction[] = Array.isArray(p.enrollmentActions)
    ? (p.enrollmentActions as unknown[]).filter(
        (a): a is EnrollmentAction =>
          typeof a === 'object' && a !== null &&
          typeof (a as any).label === 'string' &&
          typeof (a as any).status === 'string',
      )
    : [];

  const failedActionCount = actions.filter((a) => a.status === 'failed').length;
  const totalActionCount = actions.length;

  const timestamp = str(p.timestamp) ?? started;

  return {
    eventId: `${serialNumber}|${started}`,
    eventType: str(p.event) ?? 'unknown',
    name: str(p.name) ?? 'unknown',
    timestamp,
    serialNumber,
    modelName: str(p.modelName),
    modelIdentifier: str(p.modelIdentifier),
    macosVersion: str(p.macOSVersion),
    macosBuild: str(p.macOSBuild),
    setupManagerVersion: str(p.setupManagerVersion),
    startedAt: started,
    finishedAt: str(p.finished),
    durationSeconds: num(p.duration),
    computerName: str(p.computerName),
    downloadThroughput: num(p.downloadThroughput),
    uploadThroughput: num(p.uploadThroughput),
    failedActionCount,
    totalActionCount,
    hasFailedActions: failedActionCount > 0,
    isArchived: false,
    payloadJson: JSON.stringify(body),
  };
}
