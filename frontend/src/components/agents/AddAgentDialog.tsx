import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCircle2, FlaskConical, Plus, X } from 'lucide-react';
import type { Agent } from '../../types/api';
import { api, config } from '../../services';
import { setWatched } from '../../lib/failureWatch';
import { Button } from '../ui/Button';
import { CodeBlock } from '../ui/CodeBlock';

/** Where agents send events (directly to the backend, not through the dashboard). */
const BACKEND = config.apiBaseUrl || 'http://localhost:8000';
/** Online, the key is the random API_KEY Render generated; locally it's the default. */
const AGENT_KEY = config.apiBaseUrl ? 'YOUR_API_KEY' : 'development-key';

const snippet = (a: Agent) => `from tokenshield import TokenShield, TokenShieldPaused

shield = TokenShield(api_url="${BACKEND}", api_key="${AGENT_KEY}")
agent = shield.connect_agent("${a.id}", name="${a.name.replace(/"/g, '\\"')}")

def run_step(name, fn, *args):
    """Run one step of your agent and tell TokenShield how it went."""
    try:
        result = fn(*args)
        agent.log_tool_call(name, success=True)
        return result
    except TokenShieldPaused:
        raise
    except Exception as e:
        # TokenShield alerts you on failures and pauses the agent if they repeat
        agent.log_tool_call(name, success=False, error=str(e))
        raise

try:
    run_step("search_web", my_search_function, "vector databases")
except TokenShieldPaused:
    print("TokenShield paused this agent. Check the dashboard.")`;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (agent: Agent) => void;
}

/** Add a hero from the dashboard, choose how you want to hear about failures, and get the code to paste. */
export function AddAgentDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [alertEvery, setAlertEvery] = useState(true);
  const [pauseAfter, setPauseAfter] = useState('3');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Agent | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const reset = () => {
    setName(''); setDescription(''); setAlertEvery(true); setPauseAfter('3'); setBudget('');
    setError(null); setCreated(null); setTestMsg(null);
  };
  const close = () => { reset(); onClose(); };

  const pauseN = Number(pauseAfter);
  const budgetN = budget.trim() === '' ? null : Number(budget);
  const invalid = !name.trim() || !Number.isInteger(pauseN) || pauseN < 1 || (budgetN !== null && !(budgetN > 0));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const agent = await api.createAgent({ name: name.trim(), description: description.trim() });
      await api.updateAgentGuards(agent.id, {
        max_consecutive_failures: pauseN, max_task_cost: budgetN, max_task_tokens: null, max_repeated_calls: null,
      });
      setWatched(agent.id, alertEvery);
      setCreated(agent);
      onCreated?.(agent);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!created) return;
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await api.sendTestFailure(created.id);
      setTestMsg(
        r.should_stop
          ? 'Test failure sent. That was enough failures in a row, so TokenShield paused the hero and opened a peril.'
          : `Test failure sent.${alertEvery ? ' You should see an alert pop up in a few seconds.' : ''}`,
      );
    } catch (err) {
      setTestMsg(`Could not send: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  };

  const input = 'h-9 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-bronze focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-hero-title" className="w-full max-w-2xl rounded-2xl border border-line-strong bg-surface shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="add-hero-title" className="font-display text-lg font-semibold text-fg">{created ? 'Hero added' : 'Add a hero'}</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"><X className="size-4" /></button>
        </div>

        {!created ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-5 p-5">
            <label className="block">
              <span className="text-sm text-fg">Name</span>
              <input autoFocus required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Invoice Reader" className={`${input} mt-1.5`} />
            </label>
            <label className="block">
              <span className="text-sm text-fg">What does it do? <span className="text-fg-subtle">(optional)</span></span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Reads PDF invoices and fills the spreadsheet" className={`${input} mt-1.5`} />
            </label>

            <fieldset className="space-y-3 rounded-xl border border-line bg-surface-2/50 p-4">
              <legend className="px-1 text-sm font-medium text-fg">When it fails</legend>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={alertEvery} onChange={(e) => setAlertEvery(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-bronze)]" />
                <span>
                  <span className="text-sm text-fg">Alert me the moment any step fails</span>
                  <span className="block text-xs text-fg-subtle">A popup and a chime on this dashboard (turn on desktop notifications in Athena's wards to get them in the background too).</span>
                </span>
              </label>
              <label className="flex flex-wrap items-center gap-2 text-sm text-fg">
                Pause it and raise a peril after
                <input type="number" min={1} step={1} value={pauseAfter} onChange={(e) => setPauseAfter(e.target.value)} className="h-8 w-16 rounded-lg border border-line-strong bg-surface-2 px-2 text-center text-sm text-fg focus:border-bronze focus:outline-none" />
                failures in a row
              </label>
              <p className="-mt-1 text-xs text-fg-subtle">Perils are explained by the Oracle and sent to Discord/Slack/email if those are set up.</p>
              <label className="flex flex-wrap items-center gap-2 text-sm text-fg">
                Spend budget per task <span className="text-fg-subtle">(optional)</span> $
                <input type="number" min={0} step={0.01} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="2.00" className="h-8 w-24 rounded-lg border border-line-strong bg-surface-2 px-2 text-sm text-fg placeholder:text-fg-subtle focus:border-bronze focus:outline-none" />
              </label>
            </fieldset>

            {error && <p role="alert" className="text-sm text-red-300">Could not add the hero: {error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button type="submit" variant="primary" icon={Plus} loading={saving} disabled={invalid || saving}>Add hero</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
              <div className="text-sm text-fg-muted">
                <p className="text-fg"><span className="font-medium">{created.name}</span> is registered.</p>
                <p className="mt-1">
                  Its ID is <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-fg">{created.id}</code>.
                  {alertEvery && <> <BellRing className="mb-0.5 inline size-3.5 text-bronze" /> You'll be alerted on every failure.</>}{' '}
                  It pauses after {pauseN} failure{pauseN === 1 ? '' : 's'} in a row.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-fg">Paste this into your agent (Python). Wrap each step with <code className="font-mono text-xs">run_step</code>:</p>
              <CodeBlock code={snippet(created)} label="Agent connection code" />
              {config.useMock && (
                <p className="mt-2 text-xs text-amber-300/90">This is the demo site, so a real agent can't reach it. Use the test button below, or run TokenShield locally to connect a real agent.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button icon={FlaskConical} loading={testing} onClick={() => void test()}>Send a test failure</Button>
              <Link to={`/agents/${created.id}`} onClick={close} className="inline-flex h-9 items-center rounded-lg bg-bronze px-3.5 text-sm font-medium text-canvas hover:bg-bronze-soft">Open hero</Link>
              <Button variant="ghost" onClick={reset}>Add another</Button>
              {testMsg && <p role="status" className="w-full text-sm text-fg-muted">{testMsg}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
