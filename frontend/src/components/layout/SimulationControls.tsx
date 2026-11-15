import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FlaskConical, Play, Square } from 'lucide-react';
import { useSimulation } from '../../hooks/useSimulation';
import { SCENARIOS } from '../../lib/scenarios';
import { Button } from '../ui/Button';

/** Demo controls → POST /api/simulation/start | stop | trigger. */
export function SimulationControls() {
  const sim = useSimulation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button size="sm" icon={FlaskConical} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" loading={sim.pending}>
        <span className="hidden sm:inline">Simulation</span>
        <ChevronDown className="size-3 opacity-60" />
      </Button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-line-strong bg-surface-2 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-fg">Traffic simulator</p>
              <p className="text-[11px] text-fg-subtle">
                {sim.running === null ? 'Simulated agents' : sim.running ? 'Running' : 'Stopped'}
              </p>
            </div>
            <div className="flex gap-1.5">
              {sim.running !== true && (
                <Button size="sm" variant="primary" icon={Play} onClick={() => void sim.start()} disabled={sim.pending}>
                  Start all
                </Button>
              )}
              {sim.running !== false && (
                <Button size="sm" icon={Square} onClick={() => void sim.stop()} disabled={sim.pending}>
                  Stop
                </Button>
              )}
            </div>
          </div>
          <div className="p-1.5">
            <p className="px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-fg-subtle uppercase">Unleash a peril</p>
            {SCENARIOS.map(({ id, label, description, icon: Icon, recommended }) => (
              <button
                key={id}
                role="menuitem"
                type="button"
                disabled={sim.pending}
                onClick={() => {
                  void sim.trigger(id);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-3 disabled:opacity-50"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-bronze" />
                <span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-fg">
                    {label}
                    {recommended && <span className="rounded bg-bronze/15 px-1 text-[10px] text-bronze">best demo</span>}
                  </span>
                  <span className="block text-[11px] text-fg-subtle">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
