import { AlertTriangle, Bot, Coins, DollarSign, RotateCw, TrendingDown } from 'lucide-react';
import type { MetricsOverview } from '../../types/api';
import { formatCompact, formatInteger, formatPercent, formatUsd } from '../../lib/format';
import { KpiCard } from './KpiCard';

export function KpiGrid({ data, loading }: { data?: MetricsOverview; loading: boolean }) {
  const d = data;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard label="Active agents" icon={Bot} loading={loading} value={d ? formatInteger(d.active_agents) : '—'} hint={d && `of ${d.total_agents} registered`} />
      <KpiCard label="Tokens consumed" icon={Coins} loading={loading} value={d ? formatCompact(d.total_tokens) : '—'} hint={d && `${formatInteger(d.total_tokens)} total`} />
      <KpiCard label="Estimated spend" icon={DollarSign} loading={loading} value={d ? formatUsd(d.total_cost_usd) : '—'} hint="All agents, lifetime" />
      <KpiCard
        label="Potential waste"
        icon={TrendingDown}
        loading={loading}
        value={d ? formatUsd(d.wasted_cost_usd) : '—'}
        hint={d && `${formatPercent(d.wasted_cost_usd / Math.max(d.total_cost_usd, 0.01))} of spend`}
      />
      <KpiCard label="Loops detected" icon={RotateCw} loading={loading} value={d ? formatInteger(d.loops_detected) : '—'} hint="Execution loops flagged" />
      <KpiCard
        label="Active incidents"
        icon={AlertTriangle}
        loading={loading}
        alert={!!d && d.active_incidents > 0}
        value={d ? formatInteger(d.active_incidents) : '—'}
        hint={d && (d.active_incidents > 0 ? 'Need attention' : 'All clear')}
      />
    </div>
  );
}
