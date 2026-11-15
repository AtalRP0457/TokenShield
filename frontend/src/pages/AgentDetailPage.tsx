import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bot } from 'lucide-react';
import { api, ApiError } from '../services';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNow } from '../hooks/useNow';
import { bucketEvents } from '../lib/bucketEvents';
import { deriveTasks } from '../lib/deriveTasks';
import { displayAgentName } from '../lib/labels';
import {
  formatClockMs, formatCompact, formatDateTime, formatDateTimeMs, formatInteger, formatPercent, formatRelative, formatUsd, formatUsdAxis, parseUtc,
} from '../lib/format';
import { CHART, SERIES } from '../lib/chartTheme';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Skeleton } from '../components/ui/Skeleton';
import { Stat } from '../components/ui/Stat';
import { SimulatedBadge } from '../components/ui/SimulatedBadge';
import { AgentStatusBadge } from '../components/agents/AgentStatusBadge';
import { PausedBanner, ResumeAgentButton } from '../components/agents/AgentControls';
import { AgentTaskList } from '../components/agents/AgentTaskList';
import { ToolCallTable } from '../components/agents/ToolCallTable';
import { SuspiciousBehavior } from '../components/agents/SuspiciousBehavior';
import { ChartFrame } from '../components/charts/ChartFrame';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { PerilTimeline } from '../components/agents/PerilTimeline';
import { GuardsCard } from '../components/agents/GuardsCard';

const POLL_MS = 3_000;

const Back = () => (
  <Link to="/agents" className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
    <ArrowLeft className="size-3.5" /> All heroes
  </Link>
);

export function AgentDetailPage() {
  const { agentId = '' } = useParams();
  const now = useNow(5_000);
  const agent = useApiQuery(() => api.getAgent(agentId), [agentId], { refreshMs: POLL_MS });
  const events = useApiQuery(() => api.getAgentEvents(agentId, 100), [agentId], { refreshMs: POLL_MS });
  const incidents = useApiQuery(() => api.getIncidents(), [], { refreshMs: POLL_MS });

  const sortedEvents = useMemo(() => [...(events.data ?? [])].sort((a, b) => parseUtc(b.timestamp) - parseUtc(a.timestamp)), [events.data]);
  const toolCalls = sortedEvents.filter((e) => e.event_type === 'tool_call');
  const errors = sortedEvents.filter((e) => e.success === false).slice(0, 10);
  const failedCalls = toolCalls.filter((e) => e.success === false).length;
  const buckets = useMemo(() => bucketEvents(sortedEvents, now), [sortedEvents, now]);
  const tasks = useMemo(() => deriveTasks(sortedEvents, now), [sortedEvents, now]);
  const model = sortedEvents.find((e) => e.model)?.model;
  const agentIncidents = (incidents.data ?? []).filter((i) => i.agent_id === agentId).sort((a, b) => parseUtc(b.created_at) - parseUtc(a.created_at));

  if (agent.error) {
    const notFound = agent.error instanceof ApiError && agent.error.status === 404;
    return (
      <>
        <PageHeader title="Hero" breadcrumb={<Back />} />
        <Card>
          {notFound ? (
            <EmptyState icon={Bot} title="Agent not found" description={`No agent with ID “${agentId}”.`} action={<Link to="/agents" className="text-sm text-accent hover:underline">Back to heroes</Link>} />
          ) : (
            <ErrorState error={agent.error} onRetry={agent.refetch} title="Could not load agent" />
          )}
        </Card>
      </>
    );
  }

  const a = agent.data;

  return (
    <>
      <PageHeader
        breadcrumb={<Back />}
        title={
          a ? (
            <span className="flex flex-wrap items-center gap-3">
              {displayAgentName(a.name)}
              <AgentStatusBadge status={a.status} />
              {a.is_simulated && <SimulatedBadge />}
            </span>
          ) : (
            <Skeleton className="h-7 w-56" />
          )
        }
        description={a?.description}
        actions={a && <ResumeAgentButton agent={a} onResumed={() => { void agent.refetch(); void events.refetch(); }} />}
      />

      {a && <PausedBanner agent={a} />}

      <Card className="mb-4">
        <CardBody className="pt-5">
          {!a ? (
            <LoadingState rows={2} />
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 xl:grid-cols-8">
              <Stat label="Agent ID" value={<span title={a.id}>{a.id}</span>} />
              <Stat label="Model" value={model ?? '—'} hint={model ? 'from recent events' : undefined} />
              <Stat label="Registered" value={formatDateTime(a.created_at)} />
              <Stat label="Last seen" value={formatRelative(a.last_seen, now)} />
              <Stat label="Total tokens" value={formatCompact(a.total_tokens)} hint={formatInteger(a.total_tokens)} />
              <Stat label="Estimated cost" value={formatUsd(a.estimated_cost)} hint="estimate" />
              <Stat label="Recent tool calls" value={formatInteger(toolCalls.length)} hint={toolCalls.length ? `${formatPercent(failedCalls / toolCalls.length)} failed` : undefined} />
              <Stat label="Open incidents" value={a.open_incidents} />
            </dl>
          )}
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Peril timeline" description="When TokenShield caught this hero misbehaving. Hover a mark for details." />
        <CardBody>
          {incidents.error ? <ErrorState error={incidents.error} onRetry={incidents.refetch} /> : <PerilTimeline incidents={agentIncidents} now={now} />}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Token consumption" description="From the last 100 events" />
          <CardBody>
            <ChartFrame height={220} loading={events.loading} error={events.error} empty={buckets.length === 0} onRetry={events.refetch}>
              <TimeSeriesChart data={buckets} xKey="t" height={220} series={[{ key: 'tokens', label: 'Tokens', color: CHART.bronze }]} formatX={formatClockMs} formatY={formatCompact} formatTooltipValue={formatInteger} formatTooltipLabel={formatDateTimeMs} />
            </ChartFrame>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Estimated spend history" description="From the last 100 events" />
          <CardBody>
            <ChartFrame height={220} loading={events.loading} error={events.error} empty={buckets.length === 0} onRetry={events.refetch}>
              <TimeSeriesChart data={buckets} xKey="t" height={220} series={[{ key: 'cost', label: 'Estimated cost', color: SERIES[2] }]} formatX={formatClockMs} formatY={formatUsdAxis} formatTooltipValue={(v) => `${formatUsd(v)} est.`} formatTooltipLabel={formatDateTimeMs} />
            </ChartFrame>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Tool call history" description={events.data ? `${toolCalls.length} recent calls` : undefined} />
          {events.error ? <ErrorState error={events.error} onRetry={events.refetch} /> : events.loading ? <LoadingState className="p-5" /> : <ToolCallTable events={toolCalls} />}
        </Card>
        <Card>
          <CardHeader title="Current tasks" description="Grouped from recent events by task ID" />
          {events.error ? <ErrorState error={events.error} onRetry={events.refetch} /> : events.loading ? <LoadingState className="p-5" rows={3} /> : <AgentTaskList tasks={tasks} />}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Perils faced" description="Suspicious behaviour TokenShield detected for this agent" />
          {incidents.error ? <ErrorState error={incidents.error} onRetry={incidents.refetch} /> : incidents.loading ? <LoadingState className="p-5" rows={3} /> : <SuspiciousBehavior incidents={agentIncidents} />}
        </Card>
        <Card>
          <CardHeader title="Recent errors" />
          <div className="max-h-[360px] overflow-y-auto">
            {events.error ? (
              <ErrorState error={events.error} onRetry={events.refetch} />
            ) : (
              <ActivityFeed events={errors} loading={events.loading} showAgent={false} emptyTitle="No recent errors" emptyDescription="All recent calls succeeded." />
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="This hero's budgets" description="Pause this hero automatically when it crosses these limits. Leave a box empty to use the global default." />
        <GuardsCard agentId={agentId} />
      </Card>
    </>
  );
}
