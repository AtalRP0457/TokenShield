import type { ReactNode } from 'react';

/** Label/value pair used in detail panels. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-1 truncate font-mono text-sm text-fg tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-fg-subtle">{hint}</dd>}
    </div>
  );
}
