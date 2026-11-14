import { CHART } from '../../lib/chartTheme';

interface TooltipEntry {
  name?: string | number;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  dataKey?: unknown;
}

interface ChartTooltipProps {
  // Injected by Recharts when used as `content={<ChartTooltip … />}`.
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string | number;
  // Ours:
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: string) => string;
  showTotal?: boolean;
}

/** Shared dark tooltip so every chart's hover layer looks the same. */
export function ChartTooltip({ active, payload, label, valueFormatter = String, labelFormatter, showTotal }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (typeof p.value === 'number' ? p.value : 0), 0);
  return (
    <div className="min-w-40 rounded-lg border px-3 py-2 text-xs shadow-xl" style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}>
      {label !== undefined && (
        <p className="mb-1.5 font-medium text-fg">{labelFormatter ? labelFormatter(String(label)) : label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span className="size-2 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-mono text-fg tabular-nums">{typeof p.value === 'number' ? valueFormatter(p.value) : String(p.value)}</span>
          </li>
        ))}
      </ul>
      {showTotal && payload.length > 1 && (
        <div className="mt-1.5 flex justify-between border-t border-line pt-1.5">
          <span className="text-fg-muted">Total</span>
          <span className="font-mono text-fg tabular-nums">{valueFormatter(total)}</span>
        </div>
      )}
    </div>
  );
}
