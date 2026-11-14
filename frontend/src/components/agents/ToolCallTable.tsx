import { Wrench } from 'lucide-react';
import type { AgentEvent } from '../../types/api';
import { formatInteger, formatTime, formatUsd } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/States';

/** Tool-call history for one agent (tool_call, api_failure and repeated_call events). */
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
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Latency</th>
            <th className="hidden px-5 py-2 text-right font-medium sm:table-cell">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {events.map((e) => (
            <tr key={e.id} title={e.message}>
              <td className="px-5 py-2 font-mono text-xs text-fg-subtle tabular-nums">{formatTime(e.timestamp)}</td>
              <td className="px-3 py-2 font-mono text-xs text-fg">{e.tool_name ?? '—'}</td>
              <td className="px-3 py-2">
                {e.type === 'repeated_call' ? (
                  <Badge tone="warning">Repeated</Badge>
                ) : e.success === false ? (
                  <Badge tone="danger">Failed</Badge>
                ) : (
                  <Badge tone="success">OK</Badge>
                )}
              </td>
              <td className="hidden px-3 py-2 text-right font-mono text-xs text-fg-muted tabular-nums sm:table-cell">{e.latency_ms != null ? `${formatInteger(e.latency_ms)} ms` : '—'}</td>
              <td className="hidden px-5 py-2 text-right font-mono text-xs text-fg-muted tabular-nums sm:table-cell">{e.cost_usd != null ? formatUsd(e.cost_usd) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
