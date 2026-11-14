import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, RotateCcw, Search, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '../services';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNow } from '../hooks/useNow';
import type { IncidentStatus } from '../types/api';
import { formatDateTime, formatRelative, formatUsd } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Skeleton } from '../components/ui/Skeleton';
import { Stat } from '../components/ui/Stat';
import { IncidentStatusBadge, IncidentTypeLabel, SeverityBadge } from '../components/incidents/IncidentBadges';
import { GeminiExplanation } from '../components/incidents/GeminiExplanation';
import { RecommendedActions } from '../components/incidents/RecommendedActions';
import { ActivityFeed } from '../components/activity/ActivityFeed';

const Back = () => (
  <Link to="/incidents" className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
    <ArrowLeft className="size-3.5" /> Incident center
  </Link>
);

export function IncidentDetailPage() {
  const { incidentId = '' } = useParams();
  const now = useNow();
  const incident = useApiQuery(() => api.getIncident(incidentId), [incidentId]);
  const agentId = incident.data?.agent_id;
  // Related events: fetch the agent's events and keep the ones this incident references.
  const events = useApiQuery(() => (agentId ? api.getAgentEvents(agentId) : Promise.resolve([])), [agentId]);
  const [pending, setPending] = useState<IncidentStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setStatus = async (status: IncidentStatus) => {
    setPending(status);
    setActionError(null);
    try {
      const updated = await api.updateIncident(incidentId, { status });
      incident.setData(() => updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  };

  if (incident.error) {
    const notFound = incident.error instanceof ApiError && incident.error.status === 404;
    return (
      <>
        <PageHeader title="Incident" breadcrumb={<Back />} />
        <Card>
          {notFound ? (
            <EmptyState icon={ShieldAlert} title="Incident not found" description={`No incident with ID “${incidentId}”.`} action={<Link to="/incidents" className="text-sm text-accent hover:underline">Back to incidents</Link>} />
          ) : (
            <ErrorState error={incident.error} onRetry={incident.refetch} title="Could not load incident" />
          )}
        </Card>
      </>
    );
  }

  const i = incident.data;
  const related = i ? (events.data ?? []).filter((e) => i.related_event_ids.includes(e.id)).sort((a, b) => b.timestamp.localeCompare(a.timestamp)) : [];

  return (
    <>
      <PageHeader
        breadcrumb={<Back />}
        title={i ? i.title : <Skeleton className="h-7 w-80" />}
        description={i && <span className="font-mono text-xs">{i.id}</span>}
        actions={
          i && (
            <>
              {i.status === 'open' && (
                <Button size="sm" icon={Search} loading={pending === 'investigating'} disabled={pending !== null} onClick={() => void setStatus('investigating')}>
                  Mark investigating
                </Button>
              )}
              {i.status !== 'resolved' ? (
                <Button size="sm" variant="primary" icon={CheckCircle2} loading={pending === 'resolved'} disabled={pending !== null} onClick={() => void setStatus('resolved')}>
                  Mark resolved
                </Button>
              ) : (
                <Button size="sm" icon={RotateCcw} loading={pending === 'open'} disabled={pending !== null} onClick={() => void setStatus('open')}>
                  Reopen
                </Button>
              )}
            </>
          )
        }
      />

      {actionError && <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">Update failed: {actionError}</div>}

      {!i ? (
        <Card><LoadingState rows={5} className="p-5" /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardBody className="pt-5">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={i.severity} />
                  <IncidentStatusBadge status={i.status} />
                  <span className="text-xs"><IncidentTypeLabel type={i.type} /></span>
                </div>
                <p className="text-sm leading-relaxed text-fg-muted">{i.description}</p>
              </CardBody>
            </Card>
            <GeminiExplanation text={i.gemini_explanation} />
            <Card>
              <CardHeader title="Recommended actions" />
              <CardBody><RecommendedActions actions={i.recommended_actions} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Related events" description={`${i.related_event_ids.length} event${i.related_event_ids.length === 1 ? '' : 's'} referenced by this incident`} />
              <div className="border-t border-line">
                {events.error ? (
                  <ErrorState error={events.error} onRetry={events.refetch} />
                ) : related.length === 0 && !events.loading && i.related_event_ids.length > 0 ? (
                  <p className="px-5 py-4 font-mono text-xs text-fg-subtle">
                    Events are no longer in the agent's recent history: {i.related_event_ids.join(', ')}
                  </p>
                ) : (
                  <ActivityFeed events={related} loading={events.loading} showAgent={false} emptyTitle="No related events" emptyDescription="This incident has no linked events." />
                )}
              </div>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader title="Details" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                <Stat label="Agent" value={<Link to={`/agents/${i.agent_id}`} className="text-accent hover:underline">{i.agent_name}</Link>} />
                <Stat label="Estimated financial waste" value={<span className="text-orange-300">{formatUsd(i.estimated_waste_usd)}</span>} />
                <Stat label="Detected" value={formatDateTime(i.detected_at)} hint={formatRelative(i.detected_at, now)} />
                <Stat label="Resolved" value={i.resolved_at ? formatDateTime(i.resolved_at) : '—'} />
              </dl>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
