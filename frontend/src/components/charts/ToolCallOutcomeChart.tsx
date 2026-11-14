import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AgentMetric } from '../../types/api';
import { CHART } from '../../lib/chartTheme';
import { formatCompact, formatInteger, formatPercent } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

/** Successful vs failed tool calls per agent (stacked), plus an overall failure rate. */
export function ToolCallOutcomeChart({ data, height = 230 }: { data: AgentMetric[]; height?: number }) {
  const ok = data.reduce((s, a) => s + a.successful_tool_calls, 0);
  const failed = data.reduce((s, a) => s + a.failed_tool_calls, 0);
  const sorted = [...data].sort((a, b) => b.successful_tool_calls + b.failed_tool_calls - (a.successful_tool_calls + a.failed_tool_calls));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChartLegend items={[{ label: 'Successful', color: CHART.success }, { label: 'Failed', color: CHART.danger }]} />
        <p className="text-xs text-fg-muted">
          Failure rate <span className="font-mono text-fg">{formatPercent(failed / Math.max(1, ok + failed))}</span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={8}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={formatCompact} stroke={CHART.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="agent_name" width={140} stroke={CHART.axis} tick={{ fontSize: 11, fill: CHART.muted }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ChartTooltip valueFormatter={formatInteger} showTotal />} />
          <Bar dataKey="successful_tool_calls" name="Successful" stackId="calls" fill={CHART.success} maxBarSize={22} isAnimationActive={false} />
          <Bar dataKey="failed_tool_calls" name="Failed" stackId="calls" fill={CHART.danger} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
