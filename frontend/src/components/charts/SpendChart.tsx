import type { ChartPoint } from '../../lib/timeseries';
import { formatClockMs, formatDateTimeMs, formatUsd, formatUsdAxis } from '../../lib/format';
import { SERIES } from '../../lib/chartTheme';
import { TimeSeriesChart } from './TimeSeriesChart';

/** Estimated spend per time bucket. */
export function SpendChart({ data, height }: { data: ChartPoint[]; height?: number }) {
  return (
    <TimeSeriesChart
      data={data}
      xKey="t"
      height={height}
      series={[{ key: 'cost', label: 'Estimated cost', color: SERIES[2] }]}
      formatX={formatClockMs}
      formatY={formatUsdAxis}
      formatTooltipValue={(v) => `${formatUsd(v)} est.`}
      formatTooltipLabel={formatDateTimeMs}
    />
  );
}
