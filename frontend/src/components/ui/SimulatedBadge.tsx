import { FlaskConical } from 'lucide-react';

/** Shown wherever `is_simulated` is true, as the backend contract asks. */
export function SimulatedBadge({ compact }: { compact?: boolean }) {
  return (
    <span
      title="Simulated agent or event, generated for the demo"
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-violet-500/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold tracking-wider text-violet-300 normal-case ring-1 ring-violet-500/25 ring-inset"
    >
      <FlaskConical className="size-3" />
      {compact ? 'SIM' : 'SIMULATED'}
    </span>
  );
}
