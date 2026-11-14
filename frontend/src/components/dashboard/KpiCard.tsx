import type { ReactNode } from 'react';
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
}

export function KpiCard({ label, value, icon: Icon, hint, loading, alert }: KpiCardProps) {
  return (
    <Card className={cn('relative overflow-hidden p-4', alert && 'border-red-500/30')}>
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
}
