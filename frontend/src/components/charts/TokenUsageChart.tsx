import type { ChartPoint } from '../../lib/timeseries';
import { formatClockMs, formatCompact, formatDateTimeMs, formatInteger } from '../../lib/format';
import { SERIES } from '../../lib/chartTheme';
import { TimeSeriesChart } from './TimeSeriesChart';

/** Tokens per time bucket (single series, so no legend; the card title names it). */
export function TokenUsageChart({ data, height }: { data: ChartPoint[]; height?: number }) {
  return (
    <TimeSeriesChart
      data={data}
      xKey="t"
      height={height}
      series={[{ key: 'tokens', label: 'Tokens', color: SERIES[0] }]}
      formatX={formatClockMs}
      formatY={formatCompact}
      formatTooltipValue={formatInteger}
      formatTooltipLabel={formatDateTimeMs}
    />
  );
}
