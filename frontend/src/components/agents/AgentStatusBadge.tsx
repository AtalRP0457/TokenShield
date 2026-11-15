import { ShieldX } from 'lucide-react';
import type { AgentStatus } from '../../types/api';
import { AGENT_STATUS } from '../../lib/labels';
import { Badge } from '../ui/Badge';

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  if (status === 'paused') {
    return (
      <Badge tone="critical">
        <ShieldX className="size-3" /> Paused by TokenShield
      </Badge>
    );
  }
  const meta = AGENT_STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return (
    <Badge tone={meta.tone} dot pulse={status === 'active'}>
      {meta.label}
    </Badge>
  );
}
