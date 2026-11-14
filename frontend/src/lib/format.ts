const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('en-US');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdPrecise = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const formatCompact = (n: number) => compact.format(n);
export const formatInteger = (n: number) => integer.format(n);
/** Small amounts (< $0.01) get 4 decimals so they don't render as $0.00. */
export const formatUsd = (n: number) => (n !== 0 && Math.abs(n) < 0.01 ? usdPrecise.format(n) : usd.format(n));
export const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}%`;

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const formatHour = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export function formatDuration(fromIso: string, now = Date.now()): string {
  const m = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 60_000));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Compact $ for chart axes; keeps decimals for small values so ticks stay distinct. */
export function formatUsdAxis(v: number): string {
  if (v === 0) return '$0';
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) >= 10) return `$${v.toFixed(0)}`;
  if (Math.abs(v) >= 1) return `$${v.toFixed(1)}`;
  return `$${v.toFixed(2)}`;
}
