import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Agent } from '../../types/api';
import { displayAgentName } from '../../lib/labels';
import { formatCompact, formatInteger, formatRelative, formatUsd } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { AgentStatusBadge } from './AgentStatusBadge';
import { SimulatedBadge } from '../ui/SimulatedBadge';
import { cn } from '../ui/cn';

export type AgentSortKey = 'name' | 'total_tokens' | 'estimated_cost' | 'open_incidents' | 'last_seen';

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
  { key: 'estimated_cost', label: 'Est. cost', align: 'right' },
  { key: 'open_incidents', label: 'Open incidents', align: 'right' },
  { key: 'last_seen', label: 'Last seen', align: 'right' },
];

/** Table on md+ screens, stacked cards on mobile. Rows are clickable; names are real links. */
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
                  <div className="flex items-center gap-2">
                    <Link to={`/agents/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-fg hover:underline">
                      {displayAgentName(a.name)}
                    </Link>
                    {a.is_simulated && <SimulatedBadge />}
                  </div>
                  {a.description && <p className="mt-0.5 max-w-xs truncate text-xs text-fg-subtle">{a.description}</p>}
                </td>
                <td className="px-5 py-3"><AgentStatusBadge status={a.status} /></td>
                <td className="px-5 py-3 text-right font-mono tabular-nums" title={formatInteger(a.total_tokens)}>{formatCompact(a.total_tokens)}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums">{formatUsd(a.estimated_cost)}</td>
                <td className={cn('px-5 py-3 text-right font-mono tabular-nums', a.open_incidents > 0 ? 'text-orange-300' : 'text-fg-subtle')}>{a.open_incidents}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-fg-muted">{formatRelative(a.last_seen, now)}</td>
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
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-fg">{displayAgentName(a.name)}</span>
                  {a.is_simulated && <SimulatedBadge compact />}
                </span>
                <AgentStatusBadge status={a.status} />
              </div>
              <dl className="mt-2.5 grid grid-cols-4 gap-2 text-xs">
                {[
                  ['Tokens', formatCompact(a.total_tokens)],
                  ['Est. cost', formatUsd(a.estimated_cost)],
                  ['Incidents', String(a.open_incidents)],
                  ['Seen', formatRelative(a.last_seen, now)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-fg-subtle">{label}</dt>
                    <dd className="mt-0.5 truncate font-mono text-fg tabular-nums">{value}</dd>
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
