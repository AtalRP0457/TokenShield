import { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw, Save } from 'lucide-react';
import type { AgentGuards, GuardValues } from '../../types/api';
import { api } from '../../services';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Button } from '../ui/Button';
import { ErrorState, LoadingState } from '../ui/States';

type Key = keyof GuardValues;

const FIELDS: { key: Key; label: string; help: string; unit: string; step: number }[] = [
  { key: 'max_task_cost', label: 'Spend budget per task', help: 'Pause when one task costs more than this.', unit: 'USD', step: 0.01 },
  { key: 'max_task_tokens', label: 'Token budget per task', help: 'Pause when one task uses more text than this.', unit: 'tokens', step: 1000 },
  { key: 'max_repeated_calls', label: 'Identical calls before pausing', help: 'How many times it may repeat the exact same step.', unit: 'calls', step: 1 },
  { key: 'max_consecutive_failures', label: 'Failures in a row before pausing', help: 'How many errors in a row are allowed.', unit: 'failures', step: 1 },
];

const toDraft = (g: AgentGuards) =>
  Object.fromEntries(FIELDS.map((f) => [f.key, g[f.key] === null ? '' : String(g[f.key])])) as Record<Key, string>;

/** Per-hero budgets. Blank = use the global default. The backend enforces these on the next event. */
export function GuardsCard({ agentId, refreshKey = 0 }: { agentId: string; refreshKey?: number }) {
  const guards = useApiQuery(() => api.getAgentGuards(agentId), [agentId, refreshKey]);
  const [draft, setDraft] = useState<Record<Key, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (guards.data) setDraft(toDraft(guards.data));
  }, [guards.data]);

  if (guards.error) return <ErrorState error={guards.error} onRetry={guards.refetch} title="Could not load budgets" />;
  if (!guards.data || !draft) return <LoadingState rows={3} className="p-5" />;
  const g = guards.data;

  const invalid = FIELDS.some((f) => draft[f.key].trim() !== '' && !(Number(draft[f.key]) > 0));
  const dirty = FIELDS.some((f) => draft[f.key] !== (g[f.key] === null ? '' : String(g[f.key])));

  const save = async (values: GuardValues) => {
    setSaving(true);
    setMsg(null);
    try {
      const next = await api.updateAgentGuards(agentId, values);
      guards.setData(() => next);
      setMsg({ ok: true, text: 'Saved. TokenShield uses these on the very next event.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const fromDraft = (): GuardValues =>
    Object.fromEntries(FIELDS.map((f) => [f.key, draft[f.key].trim() === '' ? null : f.step === 1 || f.step === 1000 ? Math.round(Number(draft[f.key])) : Number(draft[f.key])])) as unknown as GuardValues;

  return (
    <div className="px-5 pb-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm text-fg">{f.label}</span>
            <span className="mt-0.5 block text-xs text-fg-subtle">{f.help}</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={f.step}
                value={draft[f.key]}
                placeholder={`Default: ${g.defaults[f.key]}`}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                className="h-9 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-bronze focus:outline-none"
              />
              <span className="w-16 shrink-0 text-xs text-fg-subtle">{f.unit}</span>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" icon={Save} loading={saving} disabled={!dirty || invalid || saving} onClick={() => void save(fromDraft())}>
          Save budgets
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={RotateCcw}
          disabled={saving || FIELDS.every((f) => g[f.key] === null)}
          onClick={() => void save({ max_task_tokens: null, max_task_cost: null, max_repeated_calls: null, max_consecutive_failures: null })}
        >
          Use defaults
        </Button>
        {invalid && <span className="text-xs text-red-300">Values must be positive numbers.</span>}
        {msg && (
          <span role="status" className={msg.ok ? 'inline-flex items-center gap-1 text-xs text-emerald-300' : 'text-xs text-red-300'}>
            {msg.ok && <CheckCircle2 className="size-3.5" />} {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
