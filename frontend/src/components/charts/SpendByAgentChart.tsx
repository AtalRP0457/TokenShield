import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Agent } from '../../types/api';
import { CHART } from '../../lib/chartTheme';
import { displayAgentName } from '../../lib/labels';
import { formatUsd, formatUsdAxis } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';

/** Horizontal bars of estimated cost per agent, sorted high → low. */
export function SpendByAgentChart({ data, height = 260 }: { data: Agent[]; height?: number }) {
  const rows = [...data]
    .sort((a, b) => b.estimated_cost - a.estimated_cost)
    .slice(0, 8)
    .map((a) => ({ name: displayAgentName(a.name), estimated_cost: a.estimated_cost }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={8}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={formatUsdAxis} stroke={CHART.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={150} stroke={CHART.axis} tick={{ fontSize: 11, fill: CHART.muted }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ChartTooltip valueFormatter={(v) => `${formatUsd(v)} est.`} />} />
        <Bar dataKey="estimated_cost" name="Estimated cost" fill={CHART.bronze} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
