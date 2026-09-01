import { JamfIndicator } from '@jamf/design-system-web-components-next/react-indicator';

interface Props {
  isLive: boolean;
}

export default function LiveIndicator({ isLive }: Props) {
  return (
    <JamfIndicator
      color={isLive ? 'success' : 'secondary'}
      shape="circle"
      width={10}
    >
      {isLive ? 'Live' : 'Idle'}
    </JamfIndicator>
  );
}
