import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bot } from 'lucide-react';
import { api, ApiError } from '../services';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNow } from '../hooks/useNow';
import { bucketEvents } from '../lib/bucketEvents';
import { formatCompact, formatDateTime, formatInteger, formatPercent, formatRelative, formatTime, formatUsd, formatUsdAxis } from '../lib/format';
import { CHART, SERIES } from '../lib/chartTheme';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Skeleton } from '../components/ui/Skeleton';
import { Stat } from '../components/ui/Stat';
import { AgentStatusBadge } from '../components/agents/AgentStatusBadge';
import { AgentControls, PausedBanner } from '../components/agents/AgentControls';
import { AgentTaskList } from '../components/agents/AgentTaskList';
import { ToolCallTable } from '../components/agents/ToolCallTable';
import { SuspiciousBehavior } from '../components/agents/SuspiciousBehavior';
import { ChartFrame } from '../components/charts/ChartFrame';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { ActivityFeed } from '../components/activity/ActivityFeed';

const Back = () => (
  <Link to="/agents" className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
    <ArrowLeft className="size-3.5" /> All heroes
  </Link>
);

export function AgentDetailPage() {
  const { agentId = '' } = useParams();
  const now = useNow();
  const agent = useApiQuery(() => api.getAgent(agentId), [agentId], { refreshMs: 5_000 });
  const events = useApiQuery(() => api.getAgentEvents(agentId), [agentId], { refreshMs: 5_000 });
  const incidents = useApiQuery(() => api.getIncidents(), [], { refreshMs: 10_000 });

  const sortedEvents = useMemo(() => [...(events.data ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [events.data]);
  const toolCalls = sortedEvents.filter((e) => e.type === 'tool_call' || e.type === 'api_failure' || e.type === 'repeated_call');
  const errors = sortedEvents.filter((e) => e.success === false).slice(0, 10);
  const buckets = useMemo(() => bucketEvents(sortedEvents, now), [sortedEvents, now]);
  const agentIncidents = (incidents.data ?? []).filter((i) => i.agent_id === agentId).sort((a, b) => b.detected_at.localeCompare(a.detected_at));

  if (agent.error) {
    const notFound = agent.error instanceof ApiError && agent.error.status === 404;
    return (
      <>
        <PageHeader title="Agent" breadcrumb={<Back />} />
        <Card>
          {notFound ? (
            <EmptyState icon={Bot} title="Agent not found" description={`No agent with ID “${agentId}” is registered.`} action={<Link to="/agents" className="text-sm text-accent hover:underline">Back to agents</Link>} />
          ) : (
            <ErrorState error={agent.error} onRetry={agent.refetch} title="Could not load agent" />
          )}
        </Card>
      </>
    );
  }

  const a = agent.data;
  const isShortSpan = buckets.length > 1 && Date.parse(buckets[1].timestamp) - Date.parse(buckets[0].timestamp) < 3_600_000;
  const formatX = isShortSpan ? (v: string) => formatTime(v).slice(0, 5) : formatDateTime;

  return (
    <>
      <PageHeader
        breadcrumb={<Back />}
        title={a ? <span className="flex flex-wrap items-center gap-3">{a.name}<AgentStatusBadge status={a.status} pausedBy={a.paused_by} /></span> : <Skeleton className="h-7 w-56" />}
        description={a?.description}
        actions={
          a && (
            <AgentControls
              agent={a}
              pause={(reason) => api.pauseAgent(a.id, { reason })}
              resume={() => api.resumeAgent(a.id)}
              onChange={(updated) => {
                agent.setData((prev) => (prev ? { ...prev, ...updated } : prev));
                void agent.refetch();
                void events.refetch();
              }}
            />
          )
        }
      />

      {a && <PausedBanner agent={a} />}

      {/* Agent information */}
      <Card className="mb-4">
        <CardBody className="pt-5">
          {!a ? (
            <LoadingState rows={2} />
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 xl:grid-cols-8">
              <Stat label="Agent ID" value={a.id} />
              <Stat label="Model" value={a.model} />
              <Stat label="Registered" value={formatDateTime(a.created_at)} />
              <Stat label="Last seen" value={formatRelative(a.last_seen_at, now)} />
              <Stat label="Total tokens" value={formatCompact(a.total_tokens)} hint={formatInteger(a.total_tokens)} />
              <Stat label="Est. spend" value={formatUsd(a.total_cost_usd)} />
              <Stat label="Tool calls" value={formatInteger(a.tool_calls)} hint={`${formatPercent(a.failed_tool_calls / Math.max(1, a.tool_calls))} failed`} />
              <Stat label="Incidents" value={a.incident_count} />
            </dl>
          )}
        </CardBody>
      </Card>

      {/* Token & spend history derived from this agent's events */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Token consumption" description="From recent events" />
          <CardBody>
            <ChartFrame height={220} loading={events.loading} error={events.error} empty={buckets.length === 0} onRetry={events.refetch}>
              <TimeSeriesChart data={buckets} xKey="timestamp" height={220} series={[{ key: 'tokens', label: 'Tokens', color: CHART.bronze }]} formatX={formatX} formatY={formatCompact} formatTooltipValue={formatInteger} formatTooltipLabel={formatDateTime} />
            </ChartFrame>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Spending history" description="From recent events" />
          <CardBody>
            <ChartFrame height={220} loading={events.loading} error={events.error} empty={buckets.length === 0} onRetry={events.refetch}>
              <TimeSeriesChart data={buckets} xKey="timestamp" height={220} series={[{ key: 'cost_usd', label: 'Spend', color: SERIES[2] }]} formatX={formatX} formatY={formatUsdAxis} formatTooltipValue={formatUsd} formatTooltipLabel={formatDateTime} />
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
          <CardHeader title="Current tasks" />
          {a ? <AgentTaskList tasks={a.current_tasks} /> : <LoadingState className="p-5" rows={3} />}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Perils faced" description="Suspicious behaviour TokenShield caught for this agent" />
          {incidents.error ? <ErrorState error={incidents.error} onRetry={incidents.refetch} /> : incidents.loading ? <LoadingState className="p-5" rows={3} /> : <SuspiciousBehavior incidents={agentIncidents} />}
        </Card>
        <Card>
          <CardHeader title="Recent errors" />
          <div className="max-h-[360px] overflow-y-auto">
            {events.error ? (
              <ErrorState error={events.error} onRetry={events.refetch} />
            ) : (
              <ActivityFeed events={errors} loading={events.loading} showAgent={false} emptyTitle="No recent errors" emptyDescription="All recent tool calls succeeded." />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
