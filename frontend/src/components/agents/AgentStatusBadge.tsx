import type { AgentStatus } from '../../types/api';
import { AGENT_STATUS } from '../../lib/labels';
import { Badge } from '../ui/Badge';

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const meta = AGENT_STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return (
    <Badge tone={meta.tone} dot pulse={status === 'active'}>
      {meta.label}
    </Badge>
  );
}
