import { Loader2 } from 'lucide-react';
import type { AnalysisSeverity, Incident, IncidentStatus } from '../../types/api';
import { INCIDENT_STATUS, SEVERITY, perilFor } from '../../lib/labels';
import { parseUtc } from '../../lib/format';
import { Badge } from '../ui/Badge';

export function SeverityBadge({ severity }: { severity: AnalysisSeverity }) {
  const meta = SEVERITY[severity] ?? { label: severity, tone: 'neutral' as const };
  return (
    <Badge tone={meta.tone} dot pulse={severity === 'critical'}>
      {meta.label}
    </Badge>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const meta = INCIDENT_STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** "Charybdis · Sequence loop": mythic name first, plain meaning after. */
export function IncidentTypeLabel({ type }: { type: string }) {
  const meta = perilFor(type);
  const Icon = meta.icon;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-fg-muted">
      <Icon className="size-3.5 shrink-0 text-bronze" />
      <span className="truncate">
        <span className="font-medium text-fg">{meta.peril}</span>
        <span className="text-fg-subtle"> · </span>
        {meta.label}
      </span>
    </span>
  );
}

/** Gemini usually finishes 2–10 s after an incident appears. Treat it as pending for up to a minute. */
export const ANALYSIS_PENDING_WINDOW_MS = 60_000;

export function isAnalysisPending(incident: Incident, now = Date.now()): boolean {
  return incident.gemini_analysis === null && now - parseUtc(incident.created_at) < ANALYSIS_PENDING_WINDOW_MS;
}

/** Small "Analyzing…" chip for lists. */
export function AnalyzingChip() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-bronze">
      <Loader2 className="size-3 animate-spin" /> Analyzing…
    </span>
  );
}
