import { useMemo, useState } from 'react';
import { CheckCircle2, Info, RotateCcw, Save, ServerCog, HardDrive, ShieldCheck } from 'lucide-react';
import type { ProtectionSettingKey, ProtectionSettings } from '../types/settings';
import { DEFAULT_SETTINGS, enforcementFor, loadSettings, saveSettings } from '../services/settingsStorage';
import { config } from '../services';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface FieldSpec {
  key: ProtectionSettingKey;
  label: string;
  description: string;
  unit: string;
  min: number;
  step: number;
}

const FIELDS: FieldSpec[] = [
  { key: 'maxTokensPerTask', label: 'Maximum tokens per task', description: 'Stop a task once its prompt + completion tokens exceed this budget.', unit: 'tokens', min: 1000, step: 1000 },
  { key: 'maxCostPerTaskUsd', label: 'Maximum cost per task', description: 'Stop a task once its estimated spend exceeds this amount.', unit: 'USD', min: 0.01, step: 0.01 },
  { key: 'maxConsecutiveFailures', label: 'Maximum consecutive failures', description: 'Pause the agent after this many tool or API failures in a row.', unit: 'failures', min: 1, step: 1 },
  { key: 'maxRepeatedToolCalls', label: 'Maximum repeated tool calls', description: 'Flag an execution loop when the same tool is called with identical arguments this many times.', unit: 'calls', min: 1, step: 1 },
  { key: 'maxTaskDurationMinutes', label: 'Maximum task duration', description: 'Time out tasks that run longer than this.', unit: 'minutes', min: 1, step: 1 },
];

export function SettingsPage() {
  const [saved, setSaved] = useState<ProtectionSettings>(loadSettings);
  const [draft, setDraft] = useState<Record<ProtectionSettingKey, string>>(() => toStrings(saved));
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const errors = useMemo(() => {
    const out: Partial<Record<ProtectionSettingKey, string>> = {};
    for (const f of FIELDS) {
      const n = Number(draft[f.key]);
      if (draft[f.key].trim() === '' || !Number.isFinite(n)) out[f.key] = 'Enter a number';
      else if (n < f.min) out[f.key] = `Must be at least ${f.min}`;
      else if (f.step === 1 && !Number.isInteger(n)) out[f.key] = 'Must be a whole number';
    }
    return out;
  }, [draft]);

  const dirty = FIELDS.some((f) => Number(draft[f.key]) !== saved[f.key]);
  const valid = Object.keys(errors).length === 0;
  const isDefault = FIELDS.every((f) => Number(draft[f.key]) === DEFAULT_SETTINGS[f.key]);

  const onSave = () => {
    if (!valid) return;
    const next = Object.fromEntries(FIELDS.map((f) => [f.key, Number(draft[f.key])])) as unknown as ProtectionSettings;
    if (saveSettings(next)) {
      setSaved(next);
      setStatus({ tone: 'success', text: 'Settings saved in this browser.' });
    } else {
      setStatus({ tone: 'error', text: 'Your browser blocked local storage — settings were not saved.' });
    }
  };

  return (
    <>
      <PageHeader title="Athena's wards" description="Token protection: guardrails that stop runaway agents before they burn budget." />

      <div className="mb-4 flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <div className="text-fg-muted">
          {config.useMock ? (
            <>
              <p className="font-medium text-amber-200">Mock mode: limits are enforced by the in-browser simulator</p>
              <p className="mt-1">
                When an agent breaks a limit marked <span className="text-fg">Enforced (mock)</span>, TokenShield raises an incident and stops the agent.
                The real backend doesn’t have a settings endpoint yet, so these values are saved in your browser.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-amber-200">The backend uses its own built-in limits for now</p>
              <p className="mt-1">
                TokenShield’s backend already detects loops, failure streaks and budget overruns, and pauses the agent, using its own thresholds.
                It doesn’t expose a settings endpoint yet, so the values here are saved in your browser only. Each limit will switch to{' '}
                <span className="text-fg">Enforced by backend</span> once the API supports it.
              </p>
            </>
          )}
        </div>
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <ul className="divide-y divide-line">
            {FIELDS.map((f) => {
              const enforced = enforcementFor(f.key);
              const changed = Number(draft[f.key]) !== saved[f.key];
              const err = errors[f.key];
              return (
                <li key={f.key} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center md:gap-8">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={f.key} className="text-sm font-medium text-fg">{f.label}</label>
                      {enforced === 'backend' ? (
                        <Badge tone="success"><ServerCog className="size-3" /> Enforced by backend</Badge>
                      ) : enforced === 'mock' ? (
                        <Badge tone="info"><ShieldCheck className="size-3" /> Enforced (mock)</Badge>
                      ) : (
                        <Badge tone="warning"><HardDrive className="size-3" /> Saved in browser only</Badge>
                      )}
                      {changed && <Badge tone="info">Unsaved</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-fg-subtle">{f.description}</p>
                  </div>
                  <div className="md:w-56">
                    <div className={`flex h-9 items-center rounded-lg border bg-surface-2 transition-colors focus-within:border-accent ${err ? 'border-red-500/60' : 'border-line hover:border-line-strong'}`}>
                      {f.unit === 'USD' && <span className="pl-3 text-sm text-fg-subtle">$</span>}
                      <input
                        id={f.key}
                        type="number"
                        inputMode="decimal"
                        min={f.min}
                        step={f.step}
                        value={draft[f.key]}
                        onChange={(e) => {
                          setStatus(null);
                          setDraft((d) => ({ ...d, [f.key]: e.target.value }));
                        }}
                        aria-invalid={!!err}
                        aria-describedby={err ? `${f.key}-error` : undefined}
                        className="h-full w-full min-w-0 bg-transparent px-3 font-mono text-sm text-fg tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {f.unit !== 'USD' && <span className="pr-3 text-xs text-fg-subtle">{f.unit}</span>}
                    </div>
                    {err && <p id={`${f.key}-error`} className="mt-1 text-xs text-red-300">{err}</p>}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3.5">
            {status && (
              <p className={`flex items-center gap-1.5 text-sm ${status.tone === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                {status.tone === 'success' && <CheckCircle2 className="size-4" />}
                {status.text}
              </p>
            )}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" icon={RotateCcw} disabled={isDefault} onClick={() => { setStatus(null); setDraft(toStrings(DEFAULT_SETTINGS)); }}>
                Reset to defaults
              </Button>
              <Button size="sm" disabled={!dirty} onClick={() => { setStatus(null); setDraft(toStrings(saved)); }}>
                Discard
              </Button>
              <Button size="sm" variant="primary" type="submit" icon={Save} disabled={!dirty || !valid}>
                Save changes
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </>
  );
}

function toStrings(s: ProtectionSettings): Record<ProtectionSettingKey, string> {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])) as Record<ProtectionSettingKey, string>;
}
