import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import type { Incident } from '../../types/api';
import { formatRelative, formatUsd } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { SeverityBadge } from '../incidents/IncidentBadges';
import { displayAgentName, perilFor } from '../../lib/labels';
import { EmptyState } from '../ui/States';

export function RecentIncidents({ incidents }: { incidents: Incident[] }) {
  const now = useNow();
  if (incidents.length === 0) {
    return <EmptyState icon={ShieldCheck} title="Calm seas" description="TokenShield hasn't caught any risky behaviour." />;
  }
  return (
    <ul className="-mx-2 divide-y divide-line">
      {incidents.map((inc) => (
        <li key={inc.id}>
          <Link to={`/incidents/${inc.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-fg">{inc.description}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-fg-subtle">
                <SeverityBadge severity={inc.severity} />
                <span className="truncate">
                  <span className="text-bronze">{perilFor(inc.incident_type).peril}</span> · {displayAgentName(inc.agent_name)} · {formatRelative(inc.created_at, now)}
                </span>
                <span className="ml-auto shrink-0 font-mono text-orange-300 tabular-nums">{formatUsd(inc.estimated_waste)} est.</span>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
