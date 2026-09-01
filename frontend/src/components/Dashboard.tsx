import { useState } from 'react';
import { JamfTabs } from '@jamf/design-system-web-components-next/react-tabs';
import { JamfTab } from '@jamf/design-system-web-components-next/react-tab';
import { JamfSpinner } from '@jamf/design-system-web-components-next/react-spinner';
import { useEvents } from '../hooks/useEvents.js';
import { setVisibility } from '../api.js';
import StatCards from './StatCards.js';
import Charts from './Charts.js';
import EventsTable from './EventsTable.js';
import FilterBar from './FilterBar.js';
import LiveIndicator from './LiveIndicator.js';
import HealthBanner from './HealthBanner.js';

export default function Dashboard() {
  const [params, setParams] = useState(new URLSearchParams());
  const { events, stats, isLive, health, refresh } = useEvents(params);

  const loading = events.length === 0 && !isLive;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      <HealthBanner health={health} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Enrollment Dashboard</h1>
        <LiveIndicator isLive={isLive} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-8)' }}>
          <JamfSpinner size={64} />
        </div>
      ) : (
        <>
          <StatCards stats={stats} />

          <Charts events={events} />

          <FilterBar onChange={setParams} />

          <JamfTabs>
            <JamfTab title="Active">
              <EventsTable
                events={events}
                showHidden={false}
                onVisibilityChange={refresh}
              />
            </JamfTab>
            <JamfTab title="Disabled">
              <EventsTable
                events={events}
                showHidden={true}
                onVisibilityChange={refresh}
              />
            </JamfTab>
          </JamfTabs>
        </>
      )}
    </div>
  );
}
