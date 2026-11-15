import { useEffect, useState } from 'react';
import { Bell, BellOff, FlaskConical } from 'lucide-react';
import { api } from '../../services';
import { loadWatched, onWatchedChange, setWatched } from '../../lib/failureWatch';
import { Button } from '../ui/Button';

/** Hero page: turn "alert on every failure" on/off, and send a test failure to check it works. */
export function FailureAlertControls({ agentId, onSent }: { agentId: string; onSent?: () => void }) {
  const [on, setOn] = useState(() => loadWatched().has(agentId));
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setOn(loadWatched().has(agentId));
    return onWatchedChange(() => setOn(loadWatched().has(agentId)));
  }, [agentId]);

  useEffect(() => {
    if (!msg) return;
    const id = window.setTimeout(() => setMsg(null), 5_000);
    return () => window.clearTimeout(id);
  }, [msg]);

  const test = async () => {
    setSending(true);
    try {
      const r = await api.sendTestFailure(agentId);
      setMsg(r.should_stop ? 'Sent. Enough failures in a row, so the hero is now paused.' : 'Test failure sent.');
      onSent?.();
    } catch (err) {
      setMsg(`Could not send: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {msg && <span role="status" className="text-xs text-fg-muted">{msg}</span>}
      <Button
        size="sm"
        variant={on ? 'secondary' : 'ghost'}
        icon={on ? Bell : BellOff}
        aria-pressed={on}
        title={on ? 'You get a popup on every failed step' : 'Only perils (repeated failures, loops…) alert you'}
        onClick={() => setWatched(agentId, !on)}
      >
        {on ? 'Alerting on every failure' : 'Alert on every failure'}
      </Button>
      <Button size="sm" variant="ghost" icon={FlaskConical} loading={sending} onClick={() => void test()}>Test failure</Button>
    </>
  );
}
