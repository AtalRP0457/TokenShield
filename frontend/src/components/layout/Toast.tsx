import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useSimulation } from '../../hooks/useSimulation';
import { cn } from '../ui/cn';

/** Shows the result of the last simulation action, auto-dismisses after 4s. */
export function SimulationToast() {
  const { lastMessage, dismissMessage } = useSimulation();

  useEffect(() => {
    if (!lastMessage) return;
    const id = window.setTimeout(dismissMessage, 4_000);
    return () => window.clearTimeout(id);
  }, [lastMessage, dismissMessage]);

  if (!lastMessage) return null;
  const ok = lastMessage.tone === 'success';
  const Icon = ok ? CheckCircle2 : AlertTriangle;

  return (
    <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-2.5 rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 shadow-2xl shadow-black/50">
      <Icon className={cn('mt-0.5 size-4 shrink-0', ok ? 'text-emerald-400' : 'text-red-400')} />
      <p className="text-sm text-fg">{lastMessage.text}</p>
      <button type="button" onClick={dismissMessage} aria-label="Dismiss" className="ml-1 rounded p-0.5 text-fg-subtle hover:text-fg">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
