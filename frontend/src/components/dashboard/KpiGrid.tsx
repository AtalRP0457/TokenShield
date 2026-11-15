import { AlertTriangle, Coins, DollarSign, Sailboat, Tornado, TrendingDown } from 'lucide-react';
import type { MetricsOverview } from '../../types/api';
import { formatCompact, formatInteger, formatPercent, formatUsd } from '../../lib/format';
import { KpiCard } from './KpiCard';

/** KPI row from GET /api/metrics/overview. All costs are estimates and labelled so. */
export function KpiGrid({ data, loading, totalAgents }: { data?: MetricsOverview; loading: boolean; totalAgents?: number }) {
  const d = data;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="Agents at sea" icon={Sailboat} loading={loading} to="/agents"
        value={d ? formatInteger(d.active_agents) : '—'}
        hint={totalAgents !== undefined ? `active, of ${totalAgents} registered` : 'active agents'}
      />
      <KpiCard label="Tokens consumed" icon={Coins} loading={loading} to="/activity" value={d ? formatCompact(d.total_tokens) : '—'} hint={d && `${formatInteger(d.total_tokens)} total`} />
      <KpiCard label="Estimated spend" icon={DollarSign} loading={loading} to="/agents" value={d ? formatUsd(d.estimated_cost) : '—'} hint="Estimate, not provider billing" />
      <KpiCard
        label="Potential waste"
        icon={TrendingDown}
        to="/incidents"
        loading={loading}
        value={d ? formatUsd(d.potential_waste) : '—'}
        hint={d && (d.estimated_cost > 0 ? `est. · ${formatPercent(d.potential_waste / d.estimated_cost)} of spend` : 'estimated')}
      />
      <KpiCard label="Loops detected" icon={Tornado} loading={loading} to="/incidents" value={d ? formatInteger(d.detected_loops) : '—'} hint="The Sirens and Charybdis" />
      <KpiCard
        label="Active perils"
        icon={AlertTriangle}
        to="/incidents"
        loading={loading}
        alert={!!d && d.active_incidents > 0}
        value={d ? formatInteger(d.active_incidents) : '—'}
        hint={d && (d.active_incidents > 0 ? 'Open incidents need attention' : 'Calm seas')}
      />
    </div>
  );
}
