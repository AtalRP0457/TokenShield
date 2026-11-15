import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import type { Agent, Incident } from '../../types/api';
import { displayAgentName } from '../../lib/labels';
import { formatUsd } from '../../lib/format';
import { EmptyState } from '../ui/States';
import { AgentStatusBadge } from '../agents/AgentStatusBadge';

/** "Who's burning money": heroes ranked by estimated spend, with the waste their perils caused. */
export function CostLeaderboard({ agents, incidents }: { agents: Agent[]; incidents: Incident[] }) {
  if (agents.length === 0) return <EmptyState icon={Trophy} title="No heroes yet" description="Connect an agent or start the simulation." />;
  const waste = new Map<string, number>();
  const perils = new Map<string, number>();
  for (const i of incidents) {
    waste.set(i.agent_id, (waste.get(i.agent_id) ?? 0) + i.estimated_waste);
    perils.set(i.agent_id, (perils.get(i.agent_id) ?? 0) + 1);
  }
  const ranked = [...agents].sort((a, b) => b.estimated_cost - a.estimated_cost).slice(0, 6);
  const max = Math.max(...ranked.map((a) => a.estimated_cost), 0.0001);
  return (
    <ol className="space-y-3">
      {ranked.map((a, idx) => (
        <li key={a.id}>
          <Link to={`/agents/${a.id}`} className="group block rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-2">
            <div className="flex items-center gap-3 text-sm">
              <span className={idx === 0 ? 'w-5 font-display font-semibold text-bronze' : 'w-5 text-fg-subtle tabular-nums'}>{idx + 1}</span>
              <span className="min-w-0 flex-1 truncate text-fg">{displayAgentName(a.name)}</span>
              {a.status === 'paused' && <AgentStatusBadge status={a.status} />}
              <span className="font-mono text-fg tabular-nums">{formatUsd(a.estimated_cost)}</span>
            </div>
            <div className="mt-1.5 ml-8 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-bronze" style={{ width: `${Math.max(3, (a.estimated_cost / max) * 100)}%` }} />
              </div>
              <span className="w-36 text-right text-xs text-fg-subtle">
                {perils.get(a.id) ? (
                  <><span className="text-orange-300">{formatUsd(waste.get(a.id) ?? 0)}</span> wasted · {perils.get(a.id)} peril{perils.get(a.id) === 1 ? '' : 's'}</>
                ) : (
                  'no perils'
                )}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
