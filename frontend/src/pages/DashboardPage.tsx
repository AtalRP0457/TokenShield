import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../services';
import { useApiQuery } from '../hooks/useApiQuery';
import { useLiveEvents } from '../hooks/useLiveEvents';
import { SEVERITY } from '../lib/labels';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { ErrorState, LoadingState } from '../components/ui/States';
import { KpiGrid } from '../components/dashboard/KpiGrid';
import { RecentIncidents } from '../components/dashboard/RecentIncidents';
import { ChartFrame } from '../components/charts/ChartFrame';
import { TokenUsageChart } from '../components/charts/TokenUsageChart';
import { SpendChart } from '../components/charts/SpendChart';
import { SpendByAgentChart } from '../components/charts/SpendByAgentChart';
import { ToolCallOutcomeChart } from '../components/charts/ToolCallOutcomeChart';
import { ActivityFeed } from '../components/activity/ActivityFeed';

const REFRESH_MS = 5_000;

export function DashboardPage() {
  // Each widget owns its own query, so one failing endpoint doesn't blank the page.
  const overview = useApiQuery(() => api.getOverview(), [], { refreshMs: REFRESH_MS });
  const tokens = useApiQuery(() => api.getTokenMetrics(), [], { refreshMs: REFRESH_MS });
  const cost = useApiQuery(() => api.getCostMetrics(), [], { refreshMs: REFRESH_MS });
  const perAgent = useApiQuery(() => api.getAgentMetrics(), [], { refreshMs: REFRESH_MS });
  const incidents = useApiQuery(() => api.getIncidents(), [], { refreshMs: REFRESH_MS });
  const live = useLiveEvents();

  // Unresolved first, then by severity, then newest.
  const recentIncidents = [...(incidents.data ?? [])]
    .sort(
      (a, b) =>
        Number(a.status === 'resolved') - Number(b.status === 'resolved') ||
        SEVERITY[b.severity].rank - SEVERITY[a.severity].rank ||
        b.detected_at.localeCompare(a.detected_at),
    )
    .slice(0, 5);

  return (
    <>
      <PageHeader title="The watch" description="Athena's view over every agent at sea: token use, spend and the perils they've met." />

      {overview.error ? (
        <Card className="mb-6"><ErrorState error={overview.error} onRetry={overview.refetch} title="Could not load overview metrics" /></Card>
      ) : (
        <div className="mb-6"><KpiGrid data={overview.data} loading={overview.loading} /></div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Token consumption" description="Last 24 hours, hourly" />
          <CardBody>
            <ChartFrame height={290} loading={tokens.loading} error={tokens.error} empty={!tokens.data?.length} onRetry={tokens.refetch}>
              <TokenUsageChart data={tokens.data ?? []} />
            </ChartFrame>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Spending" description="Last 24 hours, hourly · wasted spend highlighted" />
          <CardBody>
            <ChartFrame height={290} loading={cost.loading} error={cost.error} empty={!cost.data?.length} onRetry={cost.refetch}>
              <SpendChart data={cost.data ?? []} />
            </ChartFrame>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Spending by agent" description="Estimated lifetime spend" />
          <CardBody>
            <ChartFrame height={260} loading={perAgent.loading} error={perAgent.error} empty={!perAgent.data?.length} onRetry={perAgent.refetch}>
              <SpendByAgentChart data={perAgent.data ?? []} />
            </ChartFrame>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tool calls" description="Successful vs failed, per agent" />
          <CardBody>
            <ChartFrame height={260} loading={perAgent.loading} error={perAgent.error} empty={!perAgent.data?.length} onRetry={perAgent.refetch}>
              <ToolCallOutcomeChart data={perAgent.data ?? []} height={226} />
            </ChartFrame>
          </CardBody>
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
