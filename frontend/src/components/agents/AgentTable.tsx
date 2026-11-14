import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Agent } from '../../types/api';
import { formatCompact, formatInteger, formatRelative, formatUsd } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { AgentStatusBadge } from './AgentStatusBadge';
import { cn } from '../ui/cn';

export type AgentSortKey = 'name' | 'total_tokens' | 'total_cost_usd' | 'tool_calls' | 'incident_count';

interface AgentTableProps {
  agents: Agent[];
  sortKey: AgentSortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: AgentSortKey) => void;
}

const COLUMNS: { key: AgentSortKey | null; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Agent' },
  { key: null, label: 'Status' },
  { key: 'total_tokens', label: 'Tokens', align: 'right' },
  { key: 'total_cost_usd', label: 'Est. spend', align: 'right' },
  { key: 'tool_calls', label: 'Tool calls', align: 'right' },
  { key: 'incident_count', label: 'Incidents', align: 'right' },
];

/**
 * Table on md+ screens, stacked cards on mobile. Rows are fully clickable
 * (navigate on click) but the agent name is also a real <Link> so keyboard
 * users and "open in new tab" work.
 */
export function AgentTable({ agents, sortKey, sortDir, onSort }: AgentTableProps) {
  const navigate = useNavigate();
  const now = useNow();

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-fg-subtle">
              {COLUMNS.map((c) => (
                <th key={c.label} scope="col" className={cn('whitespace-nowrap px-5 py-2.5 font-medium', c.align === 'right' ? 'text-right' : 'text-left')}>
                  {c.key ? (
                    <button type="button" onClick={() => onSort(c.key!)} className={cn('inline-flex items-center gap-1 hover:text-fg', sortKey === c.key && 'text-fg')}>
                      {c.label}
                      {sortKey === c.key && <span aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {agents.map((a) => (
              <tr key={a.id} onClick={() => navigate(`/agents/${a.id}`)} className="group cursor-pointer transition-colors hover:bg-surface-2">
                <td className="px-5 py-3">
                  <Link to={`/agents/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-fg hover:underline">
                    {a.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-fg-subtle">
                    <span className="font-mono">{a.model}</span> · seen {formatRelative(a.last_seen_at, now)}
                  </p>
                </td>
                <td className="px-5 py-3"><AgentStatusBadge status={a.status} pausedBy={a.paused_by} /></td>
                <td className="px-5 py-3 text-right font-mono tabular-nums" title={formatInteger(a.total_tokens)}>{formatCompact(a.total_tokens)}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums">{formatUsd(a.total_cost_usd)}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums">
                  {formatInteger(a.tool_calls)}
                  {a.failed_tool_calls > 0 && <span className="block whitespace-nowrap text-xs text-red-300">{formatInteger(a.failed_tool_calls)} failed</span>}
                </td>
                <td className={cn('px-5 py-3 text-right font-mono tabular-nums', a.incident_count > 0 ? 'text-orange-300' : 'text-fg-subtle')}>{a.incident_count}</td>
                <td className="pr-4"><ChevronRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {agents.map((a) => (
          <li key={a.id}>
            <Link to={`/agents/${a.id}`} className="block px-4 py-3.5 hover:bg-surface-2">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium text-fg">{a.name}</span>
                <AgentStatusBadge status={a.status} pausedBy={a.paused_by} />
              </div>
              <dl className="mt-2.5 grid grid-cols-4 gap-2 text-xs">
                {[
                  ['Tokens', formatCompact(a.total_tokens)],
                  ['Spend', formatUsd(a.total_cost_usd)],
                  ['Calls', formatCompact(a.tool_calls)],
                  ['Incidents', String(a.incident_count)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-fg-subtle">{label}</dt>
                    <dd className="mt-0.5 font-mono text-fg tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
