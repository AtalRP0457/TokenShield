import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../services';
import { useApiQuery } from '../hooks/useApiQuery';
import { useLiveEvents } from '../hooks/useLiveEvents';
import { SEVERITY } from '../lib/labels';
import { fillTimeseries } from '../lib/timeseries';
import { parseUtc } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { ErrorState, LoadingState } from '../components/ui/States';
import { KpiGrid } from '../components/dashboard/KpiGrid';
import { RecentIncidents } from '../components/dashboard/RecentIncidents';
import { ChartFrame } from '../components/charts/ChartFrame';
import { TokenUsageChart } from '../components/charts/TokenUsageChart';
import { SpendChart } from '../components/charts/SpendChart';
import { SpendByAgentChart } from '../components/charts/SpendByAgentChart';
import { ToolCallOutcomeChart } from '../components/charts/ToolCallOutcomeChart';
import { ActivityFeed } from '../components/activity/ActivityFeed';

/** The backend asks clients to poll every 2–3 s. */
const POLL_MS = 3_000;

const RANGES = [
  { value: '15', label: 'Last 15 minutes' },
  { value: '60', label: 'Last hour' },
  { value: '360', label: 'Last 6 hours' },
  { value: '1440', label: 'Last 24 hours' },
];

/** Where the chart data comes from, from the response's `source` field. */
function sourceLabel(source?: string) {
  if (!source) return '';
  if (source.includes('timescale')) return ' · Tiger Data continuous aggregate';
  if (source.includes('mock')) return ' · mock data';
  return ` · ${source}`;
}

export function DashboardPage() {
  const [minutes, setMinutes] = useState(60);
  // Each widget owns its own query, so one failing endpoint doesn't blank the page.
  const overview = useApiQuery(() => api.getOverview(), [], { refreshMs: POLL_MS });
  const timeseries = useApiQuery(() => api.getTimeseries(minutes), [minutes], { refreshMs: 5_000 });
  const agents = useApiQuery(() => api.getAgents(), [], { refreshMs: 5_000 });
  const incidents = useApiQuery(() => api.getIncidents(), [], { refreshMs: POLL_MS });
  const live = useLiveEvents();

  const points = useMemo(() => (timeseries.data ? fillTimeseries(timeseries.data.series, minutes) : []), [timeseries.data, minutes]);
  const hasActivity = points.some((p) => p.calls > 0 || p.tokens > 0);
  const step = minutes <= 120 ? 'per minute' : minutes <= 360 ? 'per 5 minutes' : 'per 15 minutes';
  const chartNote = `${step}${sourceLabel(timeseries.data?.source)}`;

  // Unresolved first, then by severity, then newest.
  const recentIncidents = [...(incidents.data ?? [])]
    .sort(
      (a, b) =>
        Number(a.status === 'resolved') - Number(b.status === 'resolved') ||
        SEVERITY[b.severity].rank - SEVERITY[a.severity].rank ||
        parseUtc(b.created_at) - parseUtc(a.created_at),
    )
    .slice(0, 5);

  const tsFrame = (children: ReactNode, height: number) => (
    <ChartFrame
      height={height}
      loading={timeseries.loading}
      error={timeseries.error}
      empty={!hasActivity}
      onRetry={timeseries.refetch}
      emptyMessage="No agent activity in this window yet. Start a simulation to see data."
    >
      {children}
    </ChartFrame>
  );

  return (
    <>
      <PageHeader
        title="The watch"
        description="Athena's view over every agent at sea: token use, estimated spend and the perils they've met."
        actions={
          <Select
            aria-label="Chart time range"
            value={String(minutes)}
            onChange={(e) => setMinutes(Number(e.target.value))}
            options={RANGES}
            className="w-40"
          />
        }
      />

      {overview.error ? (
        <Card className="mb-6"><ErrorState error={overview.error} onRetry={overview.refetch} title="Could not load overview metrics" /></Card>
      ) : (
        <div className="mb-6"><KpiGrid data={overview.data} loading={overview.loading} totalAgents={agents.data?.length} /></div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Token consumption" description={chartNote} />
          <CardBody>{tsFrame(<TokenUsageChart data={points} height={260} />, 260)}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Estimated spend" description={chartNote} />
          <CardBody>{tsFrame(<SpendChart data={points} height={260} />, 260)}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Estimated spend by agent" description="Lifetime, all costs are estimates" />
          <CardBody>
            <ChartFrame height={260} loading={agents.loading} error={agents.error} empty={!agents.data?.length} onRetry={agents.refetch} emptyMessage="No agents registered yet.">
              <SpendByAgentChart data={agents.data ?? []} />
            </ChartFrame>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tool calls" description={`Successful vs failed, ${step}`} />
          <CardBody>{tsFrame(<ToolCallOutcomeChart data={points} height={222} />, 260)}</CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent perils"
            actions={<Link to="/incidents" className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg">View all <ArrowRight className="size-3" /></Link>}
          />
          <CardBody>
            {incidents.error ? (
              <ErrorState error={incidents.error} onRetry={incidents.refetch} />
            ) : incidents.loading ? (
              <LoadingState rows={5} />
            ) : (
              <RecentIncidents incidents={recentIncidents} />
            )}
          </CardBody>
        </Card>
        <Card className="flex flex-col lg:col-span-3">
          <CardHeader
            title="Ship's log"
            description="Live agent events as they happen"
            actions={<Link to="/activity" className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg">Open feed <ArrowRight className="size-3" /></Link>}
          />
          <div className="max-h-[380px] flex-1 overflow-y-auto border-t border-line">
            <ActivityFeed events={live.events.slice(0, 25)} loading={live.status === 'connecting'} compact />
          </div>
        </Card>
      </div>
    </>
  );
}
