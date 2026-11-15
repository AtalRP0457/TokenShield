import { useLiveEvents } from '../../hooks/useLiveEvents';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api, config } from '../../services';
import { Badge } from '../ui/Badge';

/** Header pill: API health plus how the live feed is updating (the backend has no WebSocket, so it polls). */
export function ConnectionIndicator() {
  const { status, statusDetail } = useLiveEvents();
  const health = useApiQuery(() => api.getHealth(), [], { refreshMs: 30_000 });
  const seconds = (config.pollIntervalMs / 1000).toFixed(1).replace(/\.0$/, '');

  if (health.error || status === 'offline') {
    return (
      <span title={health.error ? `API health check failed: ${health.error.message}` : statusDetail}>
        <Badge tone="danger" dot>Offline</Badge>
      </span>
    );
  }
  if (status === 'connecting') return <Badge tone="neutral" dot>Connecting</Badge>;
  return (
    <span title={`Refreshing every ${seconds}s${health.data ? ` · ${health.data.environment}` : ''}`}>
      <Badge tone={config.useMock ? 'info' : 'success'} dot pulse>
        {config.useMock ? 'Live · mock' : 'Live'}
      </Badge>
    </span>
  );
}
