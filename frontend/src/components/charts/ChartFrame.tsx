import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import { EmptyState, ErrorState } from '../ui/States';
import { Skeleton } from '../ui/Skeleton';

interface ChartFrameProps {
  height: number;
  loading: boolean;
  error: Error | null;
  empty: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  children: ReactNode;
}

/** Reserves the chart's height and swaps in loading / error / empty states. */
export function ChartFrame({ height, loading, error, empty, onRetry, emptyMessage = 'No data for this period yet.', children }: ChartFrameProps) {
  return (
    <div style={{ height }} className="relative w-full">
      {error ? (
        <ErrorState error={error} onRetry={onRetry} className="h-full py-0" />
      ) : loading ? (
        <Skeleton className="h-full w-full" />
      ) : empty ? (
        <EmptyState icon={BarChart3} title="Nothing to chart" description={emptyMessage} className="h-full py-0" />
      ) : (
        children
      )}
    </div>
  );
}
