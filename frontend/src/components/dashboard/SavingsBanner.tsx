import { Link } from 'react-router-dom';
import { ArrowUpRight, PiggyBank } from 'lucide-react';
import type { Incident } from '../../types/api';
import { estimateSavings, PROJECTION_MULTIPLIER } from '../../lib/savings';
import { formatUsd } from '../../lib/format';
import { Skeleton } from '../ui/Skeleton';

/** The headline number: estimated money TokenShield kept from being burned. */
export function SavingsBanner({ incidents, loading }: { incidents?: Incident[]; loading: boolean }) {
  const s = estimateSavings(incidents ?? []);
  return (
    <Link
      to="/incidents"
      className="group mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.10] via-emerald-500/[0.04] to-transparent p-5 transition-colors hover:border-emerald-400/40"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
        <PiggyBank className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-emerald-300/80 uppercase">Saved by TokenShield</p>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-32" />
        ) : (
          <p className="font-display text-3xl font-semibold text-emerald-200 tabular-nums">≈ {formatUsd(s.saved)}</p>
        )}
      </div>
      <p className="min-w-[220px] flex-1 text-sm leading-relaxed text-fg-muted">
        {s.perils > 0 ? (
          <>
            TokenShield stopped <span className="text-fg">{s.perils} peril{s.perils === 1 ? '' : 's'}</span> after they had wasted{' '}
            <span className="text-orange-300">{formatUsd(s.caught)}</span>. Left alone, loops like these keep running until someone notices,
            so we estimate {PROJECTION_MULTIPLIER}× that was avoided.
          </>
        ) : (
          'No perils caught yet. When an agent starts looping, TokenShield pauses it and this number shows the money it kept you from burning.'
        )}
      </p>
      <span className="ml-auto inline-flex items-center gap-1 text-xs text-fg-subtle group-hover:text-fg">
        See perils <ArrowUpRight className="size-3.5" />
      </span>
    </Link>
  );
}
