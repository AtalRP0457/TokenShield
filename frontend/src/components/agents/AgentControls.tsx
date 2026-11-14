import { useState } from 'react';
import { Pause, Play, ShieldX } from 'lucide-react';
import type { Agent } from '../../types/api';
import { Button } from '../ui/Button';

interface Props {
  agent: Agent;
  onChange: (agent: Agent) => void;
  pause: (reason: string) => Promise<Agent>;
  resume: () => Promise<Agent>;
}

/** Pause / resume buttons. Calls the API and hands the updated agent back. */
export function AgentControls({ agent, onChange, pause, resume }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<Agent>) => {
    setPending(true);
    setError(null);
    try {
      onChange(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {agent.status === 'paused' ? (
        <Button size="sm" variant="primary" icon={Play} loading={pending} onClick={() => void run(resume)}>
          Resume agent
        </Button>
      ) : (
        <Button size="sm" icon={Pause} loading={pending} onClick={() => void run(() => pause('Paused from the dashboard'))}>
          Pause agent
        </Button>
      )}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

/** Banner shown on a paused agent, explaining who stopped it and why. */
export function PausedBanner({ agent }: { agent: Agent }) {
  if (agent.status !== 'paused') return null;
  const byShield = agent.paused_by === 'tokenshield';
  return (
    <div role="status" className={`mb-4 flex gap-3 rounded-xl border p-4 text-sm ${byShield ? 'border-red-500/30 bg-red-500/[0.07]' : 'border-amber-500/25 bg-amber-500/[0.06]'}`}>
      {byShield ? <ShieldX className="mt-0.5 size-4 shrink-0 text-red-300" /> : <Pause className="mt-0.5 size-4 shrink-0 text-amber-300" />}
      <div>
        <p className={`font-medium ${byShield ? 'text-red-200' : 'text-amber-200'}`}>
          {byShield ? 'TokenShield stopped this agent' : 'This agent is paused'}
        </p>
        <p className="mt-1 text-fg-muted">
          {withPeriod(agent.pause_reason ?? 'No reason given')} {byShield && 'Its running tasks were halted so it stops spending tokens.'} Resume it when you’re ready.
        </p>
      </div>
    </div>
  );
}

const withPeriod = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
