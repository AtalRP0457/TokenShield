import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import type { Incident } from '../../types/api';
import { displayAgentName } from '../../lib/labels';
import { formatDateTime, formatRelative, formatUsd } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { AnalyzingChip, IncidentStatusBadge, IncidentTypeLabel, SeverityBadge, isAnalysisPending } from './IncidentBadges';
import { Button } from '../ui/Button';

interface IncidentTableProps {
  incidents: Incident[];
  onResolve: (incident: Incident) => void;
  resolvingId: string | null;
}

export function IncidentTable({ incidents, onResolve, resolvingId }: IncidentTableProps) {
  const navigate = useNavigate();
  const now = useNow(5_000);

  const resolveButton = (i: Incident) =>
    i.status !== 'resolved' && (
      <Button
        size="sm"
        variant="ghost"
        icon={CheckCircle2}
        loading={resolvingId === i.id}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onResolve(i);
        }}
      >
        Resolve
      </Button>
    );

  return (
    <>
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-subtle">
              <th className="px-5 py-2.5 font-medium">Incident</th>
              <th className="px-3 py-2.5 font-medium">Agent</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Severity</th>
              <th className="px-3 py-2.5 text-right font-medium">Est. waste</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {incidents.map((i) => (
              <tr key={i.id} onClick={() => navigate(`/incidents/${i.id}`)} className="cursor-pointer transition-colors hover:bg-surface-2">
                <td className="max-w-[300px] px-5 py-3">
                  <span className="flex items-center gap-2">
                    <Link to={`/incidents/${i.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-fg-subtle hover:text-fg">
                      {i.id}
                    </Link>
                    <span className="text-xs text-fg-subtle" title={formatDateTime(i.created_at)}>· {formatRelative(i.created_at, now)}</span>
                    {isAnalysisPending(i, now) && <AnalyzingChip />}
                  </span>
                  <p className="mt-0.5 truncate text-fg" title={i.description}>{i.description}</p>
                </td>
                <td className="px-3 py-3">
                  <Link to={`/agents/${i.agent_id}`} onClick={(e) => e.stopPropagation()} className="text-fg-muted hover:text-fg hover:underline">
                    {displayAgentName(i.agent_name)}
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs"><IncidentTypeLabel type={i.incident_type} /></td>
                <td className="px-3 py-3"><SeverityBadge severity={i.severity} /></td>
                <td className="px-3 py-3 text-right font-mono text-orange-300 tabular-nums">{formatUsd(i.estimated_waste)}</td>
                <td className="px-3 py-3"><IncidentStatusBadge status={i.status} /></td>
                <td className="px-5 py-3 text-right">{resolveButton(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line xl:hidden">
        {incidents.map((i) => (
          <li key={i.id}>
            <Link to={`/incidents/${i.id}`} className="block px-4 py-3.5 hover:bg-surface-2">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={i.severity} />
                <IncidentStatusBadge status={i.status} />
                <span className="hidden text-xs sm:inline"><IncidentTypeLabel type={i.incident_type} /></span>
                {isAnalysisPending(i, now) && <AnalyzingChip />}
                <span className="ml-auto font-mono text-xs text-orange-300 tabular-nums">{formatUsd(i.estimated_waste)} est.</span>
              </div>
              <p className="mt-2 text-sm text-fg">{i.description}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-fg-subtle">
                <span className="truncate">
                  <span className="font-mono">{i.id}</span> · {displayAgentName(i.agent_name)} · {formatRelative(i.created_at, now)}
                </span>
                {resolveButton(i)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
