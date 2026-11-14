import { ListChecks } from 'lucide-react';
import { EmptyState } from '../ui/States';

export function RecommendedActions({ actions }: { actions: string[] }) {
  if (actions.length === 0) return <EmptyState icon={ListChecks} title="No recommendations" />;
  return (
    <ol className="space-y-2.5">
      {actions.map((a, idx) => (
        <li key={a} className="flex gap-3 text-sm">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-[11px] text-fg-muted">{idx + 1}</span>
          <span className="text-fg-muted">{a}</span>
        </li>
      ))}
    </ol>
  );
}
