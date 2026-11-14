import type { CostMetricPoint } from '../../types/api';
import { formatDateTime, formatHour, formatUsd, formatUsdAxis } from '../../lib/format';
import { CHART, SERIES } from '../../lib/chartTheme';
import { TimeSeriesChart } from './TimeSeriesChart';
import { ChartLegend } from './ChartLegend';

/** Total spend as an area, with the wasted portion as a dashed line on the same $ axis. */
export function SpendChart({ data, height }: { data: CostMetricPoint[]; height?: number }) {
  return (
    <div className="space-y-3">
      <ChartLegend items={[{ label: 'Total spend', color: SERIES[2] }, { label: 'Wasted spend', color: CHART.waste, dashed: true }]} />
      <TimeSeriesChart
        data={data}
        xKey="timestamp"
        height={height}
        series={[
          { key: 'cost_usd', label: 'Total spend', color: SERIES[2] },
          { key: 'wasted_cost_usd', label: 'Wasted', color: CHART.waste, kind: 'line', dashed: true },
        ]}
        formatX={formatHour}
        formatY={formatUsdAxis}
        formatTooltipValue={formatUsd}
        formatTooltipLabel={formatDateTime}
      />
    </div>
  );
}
