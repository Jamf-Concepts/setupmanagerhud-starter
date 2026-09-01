import { JamfAlertBanner } from '@jamf/design-system-web-components-next/react-alert-banner';

interface Props {
  health: { status: string; db: string } | null;
}

export default function HealthBanner({ health }: Props) {
  if (!health || (health.status === 'ok' && health.db === 'ok')) return null;

  const isDanger = health.status === 'error' || health.db === 'error';

  return (
    <JamfAlertBanner styleType={isDanger ? 'danger' : 'warning'} withIcon variant="full-width">
      <span slot="title">{isDanger ? 'Service Degraded' : 'Service Warning'}</span>
      <p>
        API: {health.status} &mdash; DB: {health.db}
      </p>
    </JamfAlertBanner>
  );
}
