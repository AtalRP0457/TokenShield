import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from 'recharts';
import { CHART } from '../../lib/chartTheme';
import { ChartTooltip } from './ChartTooltip';

export interface SeriesSpec<T> {
  key: keyof T & string;
  label: string;
  color: string;
  /** 'area' = filled, 'line' = 2px line on top (e.g. a subset like "wasted"). */
  kind?: 'area' | 'line';
  dashed?: boolean;
}

interface TimeSeriesChartProps<T> {
  data: T[];
  xKey: keyof T & string;
  series: SeriesSpec<T>[];
  stacked?: boolean;
  height?: number;
  /** x values are epoch milliseconds. */
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  formatTooltipValue?: (value: number) => string;
  formatTooltipLabel?: (value: number) => string;
}

/**
 * Generic, reusable time-series chart (areas + optional overlay lines), one y-axis.
 * Specific charts (tokens, spend, per-agent history) are thin configs on top.
 */
export function TimeSeriesChart<T extends object>({
  data, xKey, series, stacked, height = 260, formatX, formatY, formatTooltipValue, formatTooltipLabel,
}: TimeSeriesChartProps<T>) {
  const hasLines = series.some((s) => s.kind === 'line');
  const Chart = hasLines ? ComposedChart : AreaChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        {/* `as string`: Recharts 3 can't resolve dataKey types against a generic row type; keys are still checked via SeriesSpec<T>. */}
        <XAxis dataKey={xKey as string} tickFormatter={formatX} stroke={CHART.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tickFormatter={formatY} stroke={CHART.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
          content={<ChartTooltip valueFormatter={formatTooltipValue ?? formatY} labelFormatter={formatTooltipLabel ?? formatX} showTotal={stacked} />}
        />
        {series.map((s) =>
          s.kind === 'line' ? (
            <Line key={s.key} type="monotone" dataKey={s.key as string} name={s.label} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.tooltipBg }} isAnimationActive={false} />
          ) : (
            <Area key={s.key} type="monotone" dataKey={s.key as string} name={s.label} stackId={stacked ? 'stack' : undefined} stroke={s.color} strokeWidth={2} fill={`url(#fill-${s.key})`} activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.tooltipBg }} isAnimationActive={false} />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}
