export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

/** Plain HTML legend above the plot — easier to style and read than Recharts' default. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.dashed ? (
            <span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: item.color }} />
          ) : (
            <span className="size-2.5 rounded-sm" style={{ background: item.color }} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}
