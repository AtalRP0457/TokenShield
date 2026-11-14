import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { cn } from './cn';

export function LoadingState({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  error: Error;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

export function ErrorState({ error, onRetry, title = 'Could not load data', className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 px-6 py-10 text-center', className)}>
      <div className="flex size-10 items-center justify-center rounded-full bg-red-500/10 text-red-300">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="mt-1 max-w-sm font-mono text-xs text-fg-subtle">{error.message}</p>
      </div>
      {onRetry && (
        <Button size="sm" icon={RefreshCw} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-10 text-center', className)}>
      <div className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-fg-subtle">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs text-fg-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}
