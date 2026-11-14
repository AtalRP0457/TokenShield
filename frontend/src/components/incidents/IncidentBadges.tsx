import type { IncidentStatus, IncidentType, Severity } from '../../types/api';
import { INCIDENT_STATUS, INCIDENT_TYPE, SEVERITY } from '../../lib/labels';
import { Badge } from '../ui/Badge';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY[severity];
  return (
    <Badge tone={meta.tone} dot pulse={severity === 'critical'}>
      {meta.label}
    </Badge>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const meta = INCIDENT_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** "Charybdis · Execution loop" — mythic name first, plain meaning after. */
export function IncidentTypeLabel({ type, plainOnly }: { type: IncidentType; plainOnly?: boolean }) {
  const meta = INCIDENT_TYPE[type] ?? { label: type, peril: type, icon: INCIDENT_TYPE.execution_loop.icon };
  const Icon = meta.icon;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-fg-muted">
      <Icon className="size-3.5 shrink-0 text-bronze" />
      <span className="truncate">
        {!plainOnly && <span className="font-medium text-fg">{meta.peril}</span>}
        {!plainOnly && <span className="text-fg-subtle"> · </span>}
        {meta.label}
      </span>
    </span>
  );
}
