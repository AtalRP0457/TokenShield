import { Wrench } from 'lucide-react';
import type { AgentEvent } from '../../types/api';
import { formatInteger, formatTime, formatUsd } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/States';

/** Tool-call history for one agent (events with event_type "tool_call"). */
export function ToolCallTable({ events }: { events: AgentEvent[] }) {
  if (events.length === 0) return <EmptyState icon={Wrench} title="No tool calls yet" />;
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full whitespace-nowrap text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line text-left text-xs text-fg-subtle">
            <th className="px-5 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Tool</th>
            <th className="px-3 py-2 font-medium">Result</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Tokens</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Duration</th>
            <th className="hidden px-5 py-2 text-right font-medium sm:table-cell">Est. cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {events.map((e) => (
            <tr key={e.id} title={e.error_message ?? undefined}>
              <td className="px-5 py-2 font-mono text-xs text-fg-subtle tabular-nums">{formatTime(e.timestamp)}</td>
              <td className="px-3 py-2 font-mono text-xs text-fg">{e.tool_name ?? '—'}</td>
              <td className="px-3 py-2">
                {e.success === false ? (
                  <span className="inline-flex items-center gap-2">
                    <Badge tone="danger">Failed</Badge>
                    {e.error_message && <span className="max-w-[180px] truncate text-xs text-red-300">{e.error_message}</span>}
                  </span>
                ) : e.success === true ? (
                  <Badge tone="success">OK</Badge>
                ) : (
                  <span className="text-xs text-fg-subtle">—</span>
                )}
              </td>
              <td className="hidden px-3 py-2 text-right font-mono text-xs text-fg-muted tabular-nums sm:table-cell">{e.total_tokens != null ? formatInteger(e.total_tokens) : '—'}</td>
              <td className="hidden px-3 py-2 text-right font-mono text-xs text-fg-muted tabular-nums sm:table-cell">{e.duration_ms != null ? `${formatInteger(e.duration_ms)} ms` : '—'}</td>
              <td className="hidden px-5 py-2 text-right font-mono text-xs text-fg-muted tabular-nums sm:table-cell">{e.estimated_cost != null ? formatUsd(e.estimated_cost) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
