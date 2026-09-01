import { useEffect, useState } from 'react';
import { JamfNavTopContainer } from '@jamf/design-system-web-components-next/react-nav-top-container';
import { JamfNavLogo } from '@jamf/design-system-web-components-next/react-nav-logo';
import { fetchConfig } from './api.js';
import Dashboard from './components/Dashboard.js';

export default function App() {
  const [config, setConfig] = useState<{ appTitle: string; logoUrl: string | null } | null>(null);

  useEffect(() => {
    fetchConfig().then(setConfig).catch(() => setConfig({ appTitle: 'Setup Manager HUD', logoUrl: null }));
  }, []);

  const title = config?.appTitle ?? 'Setup Manager HUD';

  return (
    <>
      <JamfNavTopContainer mobileBreakpoint={768}>
        <JamfNavLogo slot="logo" titleText={title} />
      </JamfNavTopContainer>
      <main className="g-wrap" style={{ padding: 'var(--spacing-4) 0' }}>
        <Dashboard />
      </main>
    </>
  );
}
