import { JamfCard } from '@jamf/design-system-web-components-next/react-card';
import type { StatsResponse } from '../api.js';

interface Props {
  stats: StatsResponse | null;
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

export default function StatCards({ stats }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--spacing-3)' }}>
      <JamfCard>
        <span slot="header-title">Total Enrollments</span>
        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
          {stats?.totalEnrollments ?? '—'}
        </p>
      </JamfCard>
      <JamfCard>
        <span slot="header-title">Failed Enrollments</span>
        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
          {stats?.failedEnrollments ?? '—'}
        </p>
      </JamfCard>
      <JamfCard>
        <span slot="header-title">Failure Rate</span>
        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
          {stats ? `${fmt(stats.failureRate * 100, 1)}%` : '—'}
        </p>
      </JamfCard>
      <JamfCard>
        <span slot="header-title">Avg Duration</span>
        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
          {stats?.avgDurationSeconds != null ? `${fmt(stats.avgDurationSeconds, 0)}s` : '—'}
        </p>
      </JamfCard>
      <JamfCard helperText="bytes/s">
        <span slot="header-title">Avg Download</span>
        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
          {stats?.avgDownloadThroughput != null ? fmt(stats.avgDownloadThroughput, 0) : '—'}
        </p>
      </JamfCard>
      <JamfCard helperText="bytes/s">
        <span slot="header-title">Avg Upload</span>
        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
          {stats?.avgUploadThroughput != null ? fmt(stats.avgUploadThroughput, 0) : '—'}
        </p>
      </JamfCard>
    </div>
  );
}
