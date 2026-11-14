import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AgentMetric } from '../../types/api';
import { CHART } from '../../lib/chartTheme';
import { formatUsd, formatUsdAxis } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';

/** Horizontal bars, sorted by spend — the long agent names stay readable. */
export function SpendByAgentChart({ data, height = 260 }: { data: AgentMetric[]; height?: number }) {
  const sorted = [...data].sort((a, b) => b.total_cost_usd - a.total_cost_usd);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={8}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={formatUsdAxis} stroke={CHART.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="agent_name" width={140} stroke={CHART.axis} tick={{ fontSize: 11, fill: CHART.muted }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ChartTooltip valueFormatter={formatUsd} />} />
        <Bar dataKey="total_cost_usd" name="Spend" fill={CHART.bronze} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
