import { ListChecks } from 'lucide-react';
import type { DerivedTask, DerivedTaskState } from '../../lib/deriveTasks';
import { formatCompact, formatDuration, formatRelative, formatUsd } from '../../lib/format';
import type { Tone } from '../../lib/labels';
import { useNow } from '../../hooks/useNow';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/States';

const STATE: Record<DerivedTaskState, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'info' },
  quiet: { label: 'Quiet', tone: 'neutral' },
  finished: { label: 'Finished', tone: 'success' },
};

/** Tasks reconstructed from the agent's recent events (there is no tasks endpoint). */
export function AgentTaskList({ tasks }: { tasks: DerivedTask[] }) {
  const now = useNow();
  if (tasks.length === 0) return <EmptyState icon={ListChecks} title="No tasks yet" description="Tasks appear here once the agent reports events with a task ID." />;
  return (
    <ul className="divide-y divide-line">
      {tasks.slice(0, 8).map((t) => {
        const meta = STATE[t.state];
        return (
          <li key={t.task_id} className="px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate font-mono text-xs text-fg" title={t.task_id}>{t.task_id}</p>
              <Badge tone={meta.tone} dot={t.state === 'active'} pulse={t.state === 'active'}>{meta.label}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-fg-subtle">
              <span>{formatCompact(t.tokens)} tok</span>
              <span>{formatUsd(t.cost)} est.</span>
              <span>{t.tool_calls} calls</span>
              {t.failures > 0 && <span className="text-red-300">{t.failures} failed</span>}
              <span>{t.state === 'active' ? `running ${formatDuration(t.first_seen, now)}` : `last event ${formatRelative(t.last_seen, now)}`}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
