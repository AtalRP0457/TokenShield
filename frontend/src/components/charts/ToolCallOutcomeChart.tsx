import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartPoint } from '../../lib/timeseries';
import { CHART } from '../../lib/chartTheme';
import { formatClockMs, formatDateTimeMs, formatInteger, formatPercent } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

/** Successful vs failed tool calls over time (calls − failures vs failures), plus the overall failure rate. */
export function ToolCallOutcomeChart({ data, height = 230 }: { data: ChartPoint[]; height?: number }) {
  const calls = data.reduce((s, p) => s + p.calls, 0);
  const failed = data.reduce((s, p) => s + p.failures, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChartLegend items={[{ label: 'Successful', color: CHART.success }, { label: 'Failed', color: CHART.danger }]} />
        <p className="text-xs text-fg-muted">
          {formatInteger(calls)} calls · failure rate <span className="font-mono text-fg">{formatPercent(failed / Math.max(1, calls))}</span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" tickFormatter={formatClockMs} stroke={CHART.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis allowDecimals={false} stroke={CHART.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ChartTooltip valueFormatter={formatInteger} labelFormatter={formatDateTimeMs} showTotal />} />
          <Bar dataKey="successful" name="Successful" stackId="calls" fill={CHART.success} isAnimationActive={false} />
          <Bar dataKey="failures" name="Failed" stackId="calls" fill={CHART.danger} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
