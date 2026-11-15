import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Eye, Printer, RotateCcw, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '../services';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNow } from '../hooks/useNow';
import type { Agent, AgentEvent, IncidentStatus } from '../types/api';
import { formatDateTime, formatRelative, formatUsd, parseUtc } from '../lib/format';
import { displayAgentName, perilFor } from '../lib/labels';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Skeleton } from '../components/ui/Skeleton';
import { Stat } from '../components/ui/Stat';
import { IncidentStatusBadge, IncidentTypeLabel, SeverityBadge, isAnalysisPending } from '../components/incidents/IncidentBadges';
import { GeminiExplanation } from '../components/incidents/GeminiExplanation';
import { RecommendedActions } from '../components/incidents/RecommendedActions';
import { EvidenceList } from '../components/incidents/EvidenceList';
import { ResumeAgentButton } from '../components/agents/AgentControls';
import { SimulatedBadge } from '../components/ui/SimulatedBadge';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { VoyageReplay } from '../components/incidents/VoyageReplay';
import { QuickFixCard } from '../components/incidents/QuickFixCard';
import { plainSentence } from '../lib/plain';
import { downloadText, incidentReportMarkdown } from '../lib/report';

const Back = () => (
  <Link to="/incidents" className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
    <ArrowLeft className="size-3.5" /> All perils
  </Link>
);

export function IncidentDetailPage() {
  const { incidentId = '' } = useParams();
  const now = useNow(2_000);
  // Polls so "Analyzing…" turns into Gemini's analysis without a reload.
  const incident = useApiQuery(() => api.getIncident(incidentId), [incidentId], { refreshMs: 3_000 });
  const agentId = incident.data?.agent_id;
  const agent = useApiQuery<Agent | null>(() => (agentId ? api.getAgent(agentId) : Promise.resolve(null)), [agentId], { refreshMs: 3_000 });
  const events = useApiQuery<AgentEvent[]>(() => (agentId ? api.getAgentEvents(agentId, 100) : Promise.resolve([])), [agentId]);
  const [pending, setPending] = useState<IncidentStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

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

  const analyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const updated = await api.analyzeIncident(incidentId);
      incident.setData(() => updated);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  if (incident.error && !incident.data) {
    const notFound = incident.error instanceof ApiError && incident.error.status === 404;
    return (
      <>
        <PageHeader title="Peril" breadcrumb={<Back />} />
        <Card>
          {notFound ? (
            <EmptyState icon={ShieldAlert} title="Incident not found" description={`No incident with ID “${incidentId}”.`} action={<Link to="/incidents" className="text-sm text-accent hover:underline">Back to perils</Link>} />
          ) : (
            <ErrorState error={incident.error} onRetry={incident.refetch} title="Could not load incident" />
          )}
        </Card>
      </>
    );
  }

  const i = incident.data;
  const peril = i ? perilFor(i.incident_type) : null;
  const related = i
    ? (events.data ?? []).filter((e) => (i.task_id ? e.task_id === i.task_id : true)).sort((a, b) => parseUtc(b.timestamp) - parseUtc(a.timestamp)).slice(0, 15)
    : [];
  const analysisPending = i ? isAnalysisPending(i, now) : false;

  return (
    <>
      <PageHeader
        display={false}
        breadcrumb={<Back />}
        title={i ? `${peril!.peril} · ${peril!.label}` : <Skeleton className="h-7 w-80" />}
        description={i && <span className="font-mono text-xs">{i.id}</span>}
        actions={
          i && (
            <>
              <Button size="sm" variant="ghost" icon={Download} onClick={() => downloadText(`tokenshield-${i.id}.md`, incidentReportMarkdown(i, agent.data, events.data ?? []))}>
                Export report
              </Button>
              <Button size="sm" variant="ghost" icon={Printer} onClick={() => window.print()}>
                Print / PDF
              </Button>
              {i.status === 'open' && (
                <Button size="sm" icon={Eye} loading={pending === 'acknowledged'} disabled={pending !== null} onClick={() => void setStatus('acknowledged')}>
                  Acknowledge
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

      {agent.data?.status === 'paused' && i && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.07] p-4 text-sm">
          <p className="text-fg-muted">
            <span className="font-medium text-red-200">TokenShield paused {displayAgentName(i.agent_name)}</span> so it stops spending. Resume it once the cause is fixed.
          </p>
          <ResumeAgentButton agent={agent.data} onResumed={() => void agent.refetch()} />
        </div>
      )}

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
                  <span className="text-xs"><IncidentTypeLabel type={i.incident_type} /></span>
                </div>
                <p className="text-sm leading-relaxed text-fg">{i.description}</p>
                {peril?.lore && (
                  <p className="mt-4 border-l-2 border-bronze/60 pl-3 font-serif text-sm leading-relaxed text-bronze-soft/90 italic">
                    <span className="font-semibold not-italic">{peril.peril}.</span> {peril.lore}
                  </p>
                )}
              </CardBody>
            </Card>

            <GeminiExplanation analysis={i.gemini_analysis} plainFallback={plainSentence(i.incident_type)} pending={analysisPending} analyzing={analyzing} onAnalyze={() => void analyze()} analyzeError={analyzeError} />

            <QuickFixCard incident={i} />

            <Card>
              <CardHeader title="Replay the voyage" description="Step through what the hero did, up to the moment TokenShield caught it" />
              {events.error ? <ErrorState error={events.error} onRetry={events.refetch} /> : events.loading ? <LoadingState className="p-5" rows={4} /> : <VoyageReplay incident={i} events={events.data ?? []} />}
            </Card>

            {i.gemini_analysis && i.gemini_analysis.recommended_actions.length > 0 && (
              <Card>
                <CardHeader title="Athena's counsel" description="Recommended actions from the analysis" />
                <CardBody><RecommendedActions actions={i.gemini_analysis.recommended_actions} /></CardBody>
              </Card>
            )}

            <Card>
              <CardHeader title="Detection evidence" description="What TokenShield saw when it raised this incident" />
              <CardBody><EvidenceList evidence={i.evidence} /></CardBody>
            </Card>

            <Card>
              <CardHeader title="Related events" description={i.task_id ? `Recent events from task ${i.task_id}` : 'Recent events from this agent'} />
              <div className="border-t border-line">
                {events.error ? (
                  <ErrorState error={events.error} onRetry={events.refetch} />
                ) : (
                  <ActivityFeed events={related} loading={events.loading} showAgent={false} emptyTitle="No related events" emptyDescription="These events are no longer in the agent's recent history." />
                )}
              </div>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader title="Details" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                <Stat
                  label="Agent"
                  value={
                    <span className="flex items-center gap-2">
                      <Link to={`/agents/${i.agent_id}`} className="truncate text-accent hover:underline">{displayAgentName(i.agent_name)}</Link>
                      {agent.data?.is_simulated && <SimulatedBadge compact />}
                    </span>
                  }
                />
                <Stat label="Estimated waste" value={<span className="text-orange-300">{formatUsd(i.estimated_waste)}</span>} hint="Estimate, not provider billing" />
                {i.repeated_calls !== null && <Stat label="Repeated calls" value={i.repeated_calls} />}
                <Stat label="Detected" value={formatDateTime(i.created_at)} hint={formatRelative(i.created_at, now)} />
                {i.task_id && <Stat label="Task" value={<span title={i.task_id}>{i.task_id}</span>} />}
              </dl>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
