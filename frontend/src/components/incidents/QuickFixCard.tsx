import { useState } from 'react';
import { CheckCircle2, Wand2 } from 'lucide-react';
import type { Incident } from '../../types/api';
import { api } from '../../services';
import { useApiQuery } from '../../hooks/useApiQuery';
import { quickFixFor } from '../../lib/quickFix';
import { plainFor } from '../../lib/plain';
import { Button } from '../ui/Button';

/** Athena's quick fix: one concrete budget change, applied with one click. */
export function QuickFixCard({ incident, onApplied }: { incident: Incident; onApplied?: () => void }) {
  const guards = useApiQuery(() => api.getAgentGuards(incident.agent_id), [incident.agent_id]);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fix = guards.data ? quickFixFor(incident, guards.data) : null;
  const general = plainFor(incident.incident_type).fix;

  const apply = async () => {
    if (!guards.data || !fix) return;
    setApplying(true);
    setError(null);
    try {
      const g = guards.data;
      const next = await api.updateAgentGuards(incident.agent_id, {
        max_task_tokens: g.max_task_tokens, max_task_cost: g.max_task_cost,
        max_repeated_calls: g.max_repeated_calls, max_consecutive_failures: g.max_consecutive_failures,
        ...fix.patch,
      });
      guards.setData(() => next);
      setDone(fix.title);
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-xl border border-sky-400/25 bg-sky-400/[0.05] p-5">
      <div className="mb-2 flex items-center gap-2">
        <Wand2 className="size-4 text-sky-300" />
        <h3 className="font-display text-sm font-semibold tracking-wide text-fg">Athena's quick fix</h3>
      </div>
      <p className="text-sm leading-relaxed text-fg-muted">{general}</p>
      {done ? (
        <p role="status" className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" /> Applied: {done}. You can change it any time on the hero's page.
        </p>
      ) : fix ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg">{fix.title}</p>
            <p className="mt-0.5 text-xs text-fg-subtle">{fix.why}</p>
          </div>
          <Button size="sm" variant="primary" icon={Wand2} loading={applying} onClick={() => void apply()}>Apply fix</Button>
        </div>
      ) : guards.data ? (
        <p className="mt-3 text-xs text-fg-subtle">This hero's budgets are already tight for this kind of peril. Fix the cause, then resume it.</p>
      ) : null}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">Could not apply: {error}</p>}
    </div>
  );
}
