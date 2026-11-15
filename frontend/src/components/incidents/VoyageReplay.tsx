import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Pause, Play, RotateCcw, ShieldCheck, SkipBack, SkipForward, XCircle } from 'lucide-react';
import type { AgentEvent, Incident } from '../../types/api';
import { formatClockMs, formatUsd, parseUtc } from '../../lib/format';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/States';
import { cn } from '../ui/cn';

const STEP_MS = 800;

function label(e: AgentEvent) {
  if (e.tool_name) return `${e.tool_name}${e.success === false ? ' failed' : ''}`;
  if (e.event_type === 'llm_call') return `AI call · ${(e.total_tokens ?? 0).toLocaleString('en-US')} tokens`;
  return e.event_type.replace(/_/g, ' ');
}

/** "Replay the voyage": step through the task's events up to the moment TokenShield caught the peril. */
export function VoyageReplay({ incident, events }: { incident: Incident; events: AgentEvent[] }) {
  const steps = useMemo(() => {
    const caughtAt = parseUtc(incident.created_at);
    const pool = events
      .filter((e) => (incident.task_id ? e.task_id === incident.task_id : true))
      .sort((a, b) => parseUtc(a.timestamp) - parseUtc(b.timestamp));
    // The run-up to the catch, plus whatever came right after (e.g. the pause event).
    const before = pool.filter((e) => parseUtc(e.timestamp) <= caughtAt + 1500).slice(-14);
    const after = pool.filter((e) => parseUtc(e.timestamp) > caughtAt + 1500).slice(0, 2);
    return { list: [...before, ...after], caughtIndex: Math.max(0, before.length - 1) };
  }, [events, incident]);

  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = steps.list.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (pos >= last) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setPos((p) => p + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, pos, last]);

  if (steps.list.length === 0) {
    return <EmptyState icon={RotateCcw} title="Nothing to replay" description="This task's events are no longer in the hero's recent history." className="py-8" />;
  }

  const shown = steps.list.slice(0, pos + 1);
  const spent = shown.reduce((s, e) => s + (e.estimated_cost ?? 0), 0);
  const failures = shown.filter((e) => e.success === false).length;
  const caught = pos >= steps.caughtIndex;
  const cur = steps.list[pos];

  return (
    <div className="px-5 pb-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon={SkipBack} aria-label="Previous step" disabled={pos === 0} onClick={() => { setPlaying(false); setPos((p) => Math.max(0, p - 1)); }} />
        {playing ? (
          <Button size="sm" variant="primary" icon={Pause} onClick={() => setPlaying(false)}>Pause</Button>
        ) : (
          <Button size="sm" variant="primary" icon={Play} onClick={() => { if (pos >= last) setPos(0); setPlaying(true); }}>
            {pos >= last ? 'Replay' : pos === 0 ? 'Play the voyage' : 'Continue'}
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={SkipForward} aria-label="Next step" disabled={pos >= last} onClick={() => { setPlaying(false); setPos((p) => Math.min(last, p + 1)); }} />
        <span className="ml-auto text-xs text-fg-subtle tabular-nums">
          Step {pos + 1} of {steps.list.length} · {formatUsd(spent)} spent · {failures} failed
        </span>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={cn('h-full rounded-full transition-all', caught ? 'bg-emerald-400' : 'bg-bronze')} style={{ width: `${((pos + 1) / steps.list.length) * 100}%` }} />
      </div>

      <div
        role="status"
        className={cn(
          'mb-3 flex items-start gap-2 rounded-lg border p-3 text-sm',
          caught ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-200' : 'border-line bg-surface-2 text-fg-muted',
        )}
      >
        {caught ? <ShieldCheck className="mt-0.5 size-4 shrink-0" /> : cur.success === false ? <XCircle className="mt-0.5 size-4 shrink-0 text-red-300" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-fg-subtle" />}
        <span>
          {caught
            ? pos === steps.caughtIndex
              ? 'TokenShield caught the peril here and paused the hero, so the waste stops growing.'
              : 'After the catch: the hero stays paused until you resume it.'
            : `${label(cur)}${cur.error_message ? ` (${cur.error_message})` : ''}. The waste keeps adding up…`}
        </span>
      </div>

      <ol className="max-h-72 space-y-1 overflow-y-auto">
        {steps.list.map((e, idx) => (
          <li
            key={e.id}
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-1.5 text-xs transition-opacity',
              idx > pos && 'opacity-25',
              idx === pos && 'bg-surface-3',
              idx === steps.caughtIndex && idx <= pos && 'ring-1 ring-emerald-500/40',
            )}
          >
            <span className="w-6 text-fg-subtle tabular-nums">{idx + 1}</span>
            <span className="w-16 font-mono text-fg-subtle">{formatClockMs(parseUtc(e.timestamp))}</span>
            <span className={cn('min-w-0 flex-1 truncate', e.success === false ? 'text-red-300' : 'text-fg')}>{label(e)}</span>
            {idx === steps.caughtIndex && <span className="text-emerald-300">caught</span>}
            <span className="w-16 text-right font-mono text-fg-subtle tabular-nums">{formatUsd(e.estimated_cost ?? 0)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
