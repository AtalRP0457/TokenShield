import { useLiveEvents } from '../../hooks/useLiveEvents';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../services';
import type { FeedStatus } from '../../services/liveFeed';
import { Badge } from '../ui/Badge';
import type { Tone } from '../../lib/labels';

const FEED: Record<FeedStatus, { label: string; tone: Tone; pulse?: boolean }> = {
  connecting: { label: 'Connecting', tone: 'neutral' },
  mock: { label: 'Live · mock', tone: 'info', pulse: true },
  websocket: { label: 'Live · WebSocket', tone: 'success', pulse: true },
  polling: { label: 'Live · polling', tone: 'success' },
  offline: { label: 'Offline', tone: 'danger' },
};

/** Header pill showing API health and which live transport is in use. */
export function ConnectionIndicator() {
  const { status, statusDetail } = useLiveEvents();
  const health = useApiQuery(() => api.getHealth(), [], { refreshMs: 30_000 });
  const apiDown = health.error !== null;
  const meta = apiDown ? FEED.offline : FEED[status];
  const title = apiDown ? `API health check failed: ${health.error?.message}` : statusDetail ?? `Live feed via ${status}`;

  return (
    <span title={title}>
      <Badge tone={meta.tone} dot pulse={meta.pulse}>
        {meta.label}
      </Badge>
    </span>
  );
}
