import { useState } from 'react';
import { Play, ShieldX } from 'lucide-react';
import type { Agent } from '../../types/api';
import { api } from '../../services';
import { Button } from '../ui/Button';

/**
 * "Resume agent" → POST /api/agents/{id}/resume. The backend has no pause
 * endpoint (TokenShield pauses agents itself), so there is no pause button.
 */
export function ResumeAgentButton({ agent, onResumed }: { agent: Agent; onResumed: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (agent.status !== 'paused') return null;

  const resume = async () => {
    setPending(true);
    setError(null);
    try {
      await api.resumeAgent(agent.id);
      onResumed();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="primary" icon={Play} loading={pending} onClick={() => void resume()}>
        Resume agent
      </Button>
      {error && <p role="alert" className="text-xs text-red-300">Couldn't resume: {error}</p>}
    </div>
  );
}

/** Banner on a paused agent. */
export function PausedBanner({ agent }: { agent: Agent }) {
  if (agent.status !== 'paused') return null;
  return (
    <div role="status" className="mb-4 flex gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.07] p-4 text-sm">
      <ShieldX className="mt-0.5 size-4 shrink-0 text-red-300" />
      <div>
        <p className="font-medium text-red-200">TokenShield paused this agent</p>
        <p className="mt-1 text-fg-muted">
          It hit a runaway pattern (see Perils faced below), so TokenShield paused it to stop the spending. Fix the cause, then resume it.
        </p>
      </div>
    </div>
  );
}
