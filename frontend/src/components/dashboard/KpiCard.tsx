import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../ui/cn';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  loading?: boolean;
  /** Highlights the card when the metric needs attention (e.g. open incidents). */
  alert?: boolean;
  /** Makes the whole card a link to the page with the details. */
  to?: string;
}

export function KpiCard({ label, value, icon: Icon, hint, loading, alert, to }: KpiCardProps) {
  const card = (
    <Card className={cn('relative h-full overflow-hidden p-4 transition-colors', alert && 'border-red-500/30', to && 'group-hover:border-bronze/50 group-hover:bg-surface-2')}>
      {alert && <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <Icon className={cn('size-4', alert ? 'text-red-400' : 'text-fg-subtle')} />
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </>
      ) : (
        <>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
        </>
      )}
    </Card>
  );
  if (!to) return card;
  return (
    <Link to={to} className="group relative block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`${label}: view details`}>
      {card}
      <ArrowUpRight className="pointer-events-none absolute right-3 bottom-3 size-3.5 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
