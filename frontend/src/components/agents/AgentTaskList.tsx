import { ListChecks } from 'lucide-react';
import type { AgentTask } from '../../types/api';
import { TASK_STATUS } from '../../lib/labels';
import { formatCompact, formatDuration, formatUsd } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/States';

export function AgentTaskList({ tasks }: { tasks: AgentTask[] }) {
  const now = useNow();
  if (tasks.length === 0) return <EmptyState icon={ListChecks} title="No tasks" description="This agent has no recorded tasks." />;
  const ordered = [...tasks].sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running'));
  return (
    <ul className="divide-y divide-line">
      {ordered.map((t) => {
        const meta = TASK_STATUS[t.status];
        return (
          <li key={t.id} className="px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm text-fg">{t.name}</p>
              <Badge tone={meta.tone} dot={t.status === 'running'} pulse={t.status === 'running'}>{meta.label}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-fg-subtle">
              <span>{formatCompact(t.tokens_used)} tok</span>
              <span>{formatUsd(t.cost_usd)}</span>
              <span>{t.tool_calls} calls</span>
              <span>{t.status === 'running' ? `running ${formatDuration(t.started_at, now)}` : `started ${formatDuration(t.started_at, now)} ago`}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
