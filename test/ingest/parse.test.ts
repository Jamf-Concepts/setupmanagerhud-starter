import { describe, it, expect } from 'vitest';
import { parseWebhook, ParseError } from '../../src/ingest/parse.js';

const started = {
  name: 'Started',
  event: 'com.jamf.setupmanager.started',
  timestamp: '2026-08-31T10:00:00Z',
  started: '2026-08-31T10:00:00Z',
  modelName: 'MacBook Pro',
  modelIdentifier: 'Mac15,3',
  macOSBuild: '25C57',
  macOSVersion: '26.2',
  serialNumber: 'ABC123',
  setupManagerVersion: '2.0.0',
};

const finished = {
  name: 'Finished',
  event: 'com.jamf.setupmanager.finished',
  timestamp: '2026-08-31T10:05:00Z',
  started: '2026-08-31T10:00:00Z',
  finished: '2026-08-31T10:05:00Z',
  duration: 300,
  modelName: 'MacBook Pro',
  modelIdentifier: 'Mac15,3',
  macOSBuild: '25C57',
  macOSVersion: '26.2',
  serialNumber: 'ABC123',
  setupManagerVersion: '2.0.0',
  computerName: 'Danny-Mac',
  enrollmentActions: [
    { label: 'Microsoft Outlook', status: 'failed' },
    { label: 'Slack', status: 'finished' },
    { label: 'Chrome', status: 'finished' },
  ],
  uploadThroughput: 350000,
  downloadThroughput: 900000,
};

describe('parseWebhook', () => {
  it('derives the enrollment id from serial + started', () => {
    const r = parseWebhook(started);
    expect(r.eventId).toBe('ABC123|2026-08-31T10:00:00Z');
    expect(r.startedAt).toBe('2026-08-31T10:00:00Z');
  });

  it('walks enrollmentActions into derived counts', () => {
    const r = parseWebhook(finished);
    expect(r.totalActionCount).toBe(3);
    expect(r.failedActionCount).toBe(1);
    expect(r.hasFailedActions).toBe(true);
    expect(r.durationSeconds).toBe(300);
    expect(r.computerName).toBe('Danny-Mac');
  });

  it('keeps eventId stable across Started/Finished (same enrollment)', () => {
    expect(parseWebhook(started).eventId).toBe(parseWebhook(finished).eventId);
  });

  it('preserves the raw payload as JSON', () => {
    const r = parseWebhook(started);
    expect(JSON.parse(r.payloadJson).serialNumber).toBe('ABC123');
  });

  it('throws ParseError when serialNumber is missing', () => {
    expect(() => parseWebhook({ ...started, serialNumber: undefined })).toThrow(ParseError);
  });

  it('throws ParseError when started is missing', () => {
    expect(() => parseWebhook({ ...started, started: undefined })).toThrow(ParseError);
  });

  it('throws ParseError on non-object body', () => {
    expect(() => parseWebhook('nope')).toThrow(ParseError);
  });
});
