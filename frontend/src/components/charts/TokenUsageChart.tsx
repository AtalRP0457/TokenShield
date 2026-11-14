import type { TokenMetricPoint } from '../../types/api';
import { formatCompact, formatHour, formatInteger, formatDateTime } from '../../lib/format';
import { SERIES } from '../../lib/chartTheme';
import { TimeSeriesChart } from './TimeSeriesChart';
import { ChartLegend } from './ChartLegend';

export function TokenUsageChart({ data, height }: { data: TokenMetricPoint[]; height?: number }) {
  return (
    <div className="space-y-3">
      <ChartLegend items={[{ label: 'Input tokens', color: SERIES[0] }, { label: 'Output tokens', color: SERIES[6] }]} />
      <TimeSeriesChart
        data={data}
        xKey="timestamp"
        stacked
        height={height}
        series={[
          { key: 'input_tokens', label: 'Input', color: SERIES[0] },
          { key: 'output_tokens', label: 'Output', color: SERIES[6] },
        ]}
        formatX={formatHour}
        formatY={formatCompact}
        formatTooltipValue={formatInteger}
        formatTooltipLabel={formatDateTime}
      />
    </div>
  );
}
