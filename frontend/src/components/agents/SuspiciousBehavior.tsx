import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import type { Incident } from '../../types/api';
import { formatRelative, formatUsd } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { IncidentStatusBadge, IncidentTypeLabel, SeverityBadge } from '../incidents/IncidentBadges';
import { EmptyState } from '../ui/States';

/** Incidents detected for one agent — TokenShield's "suspicious behaviour" signal. */
export function SuspiciousBehavior({ incidents }: { incidents: Incident[] }) {
  const now = useNow();
  if (incidents.length === 0) {
    return <EmptyState icon={ShieldCheck} title="Nothing suspicious" description="No loops, failure storms or budget overruns detected for this agent." />;
  }
  return (
    <ul className="divide-y divide-line">
      {incidents.map((i) => (
        <li key={i.id}>
          <Link to={`/incidents/${i.id}`} className="block px-5 py-3 transition-colors hover:bg-surface-2">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={i.severity} />
              <IncidentStatusBadge status={i.status} />
              <span className="ml-auto font-mono text-xs text-orange-300 tabular-nums">{formatUsd(i.estimated_waste_usd)} wasted</span>
            </div>
            <p className="mt-1.5 text-sm text-fg">{i.title}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs">
              <IncidentTypeLabel type={i.type} />
              <span className="text-fg-subtle">· {formatRelative(i.detected_at, now)}</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
