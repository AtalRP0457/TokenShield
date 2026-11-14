import { ShieldX } from 'lucide-react';
import type { AgentStatus, PausedBy } from '../../types/api';
import { AGENT_STATUS } from '../../lib/labels';
import { Badge } from '../ui/Badge';

export function AgentStatusBadge({ status, pausedBy }: { status: AgentStatus; pausedBy?: PausedBy | null }) {
  if (status === 'paused' && pausedBy === 'tokenshield') {
    return (
      <Badge tone="critical">
        <ShieldX className="size-3" /> Stopped by TokenShield
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
