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

export function IncidentTypeLabel({ type }: { type: IncidentType }) {
  const meta = INCIDENT_TYPE[type] ?? { label: type, icon: INCIDENT_TYPE.execution_loop.icon };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-muted">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}
