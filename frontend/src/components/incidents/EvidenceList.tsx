import { humanize } from '../../lib/format';

function render(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.map(render).join(' → ');
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number') return value.toLocaleString('en-US');
  return String(value);
}

/** `evidence` is free-form (keys depend on incident_type), so render it as key/value pairs. */
export function EvidenceList({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence ?? {});
  if (entries.length === 0) return <p className="text-sm text-fg-subtle">No evidence recorded.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-fg-subtle">{humanize(k)}</dt>
          <dd className="mt-0.5 truncate font-mono text-sm text-fg" title={render(v)}>{render(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
