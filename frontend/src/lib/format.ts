const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('en-US');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd4 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });
const usd6 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 6, maximumFractionDigits: 6 });

/**
 * Parse an API timestamp as UTC. The contract says timestamps are UTC, but
 * aggregate rows may arrive without a "Z" (e.g. "2026-11-14T23:35:00"), which
 * JavaScript would otherwise read as LOCAL time. Always go through this.
 */
export function parseUtc(iso: string): number {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  return Date.parse(hasZone ? iso : `${iso}Z`);
}

export const formatCompact = (n: number) => compact.format(n);
export const formatInteger = (n: number) => integer.format(n);

/** Small amounts get more decimals so they don't render as $0.00 (agent calls cost fractions of a cent). */
export function formatUsd(n: number): string {
  const a = Math.abs(n);
  if (a === 0) return usd.format(0);
  if (a < 0.0001) return usd6.format(n);
  if (a < 0.01) return usd4.format(n);
  return usd.format(n);
}

/** Every cost in TokenShield is an estimate (not provider billing) — the contract asks us to say so. */
export const formatEstUsd = (n: number) => `${formatUsd(n)} est.`;

export const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}%`;

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - parseUtc(iso));
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
  new Date(parseUtc(iso)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const formatClock = (iso: string) =>
  new Date(parseUtc(iso)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

export const formatDateTime = (iso: string) =>
  new Date(parseUtc(iso)).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export function formatDuration(fromIso: string, toMs = Date.now()): string {
  const s = Math.max(0, Math.floor((toMs - parseUtc(fromIso)) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Compact $ for chart axes; keeps significant digits for tiny values so ticks stay distinct. */
export function formatUsdAxis(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return '$0';
  if (a >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  if (a >= 10) return `$${v.toFixed(0)}`;
  if (a >= 1) return `$${v.toFixed(1)}`;
  if (a >= 0.01) return `$${v.toFixed(2)}`;
  return `$${Number(v.toPrecision(2))}`;
}

/** "token_heavy" / "REPEATED_TOOL_CALL" → "Token heavy" / "Repeated tool call". */
export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Axis/tooltip labels for epoch-ms chart x values. */
export const formatClockMs = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
export const formatDateTimeMs = (ms: number) =>
  new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
