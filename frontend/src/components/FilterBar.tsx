import { useState } from 'react';
import { JamfCard } from '@jamf/design-system-web-components-next/react-card';

interface Filters {
  eventType: string;
  failedOnly: boolean;
  macOSVersion: string;
  model: string;
  serial: string;
  search: string;
  timeRange: string;
}

interface Props {
  onChange: (params: URLSearchParams) => void;
}

const TIME_RANGES = ['1h', '6h', '24h', '7d', '30d', 'all'];

function toParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.eventType) p.set('eventType', f.eventType);
  if (f.failedOnly) p.set('failedOnly', 'true');
  if (f.macOSVersion) p.set('macOSVersion', f.macOSVersion);
  if (f.model) p.set('model', f.model);
  if (f.serial) p.set('serial', f.serial);
  if (f.search) p.set('search', f.search);
  if (f.timeRange && f.timeRange !== 'all') p.set('timeRange', f.timeRange);
  return p;
}

export default function FilterBar({ onChange }: Props) {
  const [filters, setFilters] = useState<Filters>({
    eventType: '', failedOnly: false, macOSVersion: '',
    model: '', serial: '', search: '', timeRange: 'all',
  });

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    onChange(toParams(next));
  }

  const inputStyle = {
    border: '1px solid var(--color-border-primary)',
    borderRadius: 'var(--border-radius-sm)',
    padding: 'var(--spacing-1) var(--spacing-2)',
    fontSize: 'var(--font-size-sm)',
    background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
  } as const;

  return (
    <JamfCard>
      <span slot="header-title">Filters</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)' }}>
          Time Range
          <select style={inputStyle} value={filters.timeRange} onChange={e => update({ timeRange: e.target.value })}>
            {TIME_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)' }}>
          Event Type
          <input style={inputStyle} value={filters.eventType} placeholder="e.g. Enrollment" onChange={e => update({ eventType: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)' }}>
          macOS Version
          <input style={inputStyle} value={filters.macOSVersion} placeholder="e.g. 14.5" onChange={e => update({ macOSVersion: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)' }}>
          Model
          <input style={inputStyle} value={filters.model} placeholder="e.g. MacBook Pro" onChange={e => update({ model: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)' }}>
          Serial
          <input style={inputStyle} value={filters.serial} placeholder="Serial number" onChange={e => update({ serial: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)' }}>
          Search
          <input style={inputStyle} value={filters.search} placeholder="Full-text search" onChange={e => update({ search: e.target.value })} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.failedOnly} onChange={e => update({ failedOnly: e.target.checked })} />
          Failed Only
        </label>
      </div>
    </JamfCard>
  );
}
