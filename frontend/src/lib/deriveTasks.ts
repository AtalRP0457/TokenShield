import type { AgentEvent } from '../types/api';
import { parseUtc } from './format';

export type DerivedTaskState = 'active' | 'finished' | 'quiet';

export interface DerivedTask {
  task_id: string;
  first_seen: string;
  last_seen: string;
  events: number;
  tool_calls: number;
  failures: number;
  tokens: number;
  cost: number;
  state: DerivedTaskState;
}

/** A task that reported something in the last minute counts as active. */
const ACTIVE_WINDOW_MS = 60_000;

/**
 * The API has no tasks endpoint, but every event carries `task_id`, so the
 * agent's current tasks are reconstructed from its recent events.
 */
export function deriveTasks(events: AgentEvent[], now = Date.now()): DerivedTask[] {
  const byTask = new Map<string, DerivedTask>();
  for (const e of events) {
    if (!e.task_id) continue;
    const t = byTask.get(e.task_id) ?? {
      task_id: e.task_id, first_seen: e.timestamp, last_seen: e.timestamp,
      events: 0, tool_calls: 0, failures: 0, tokens: 0, cost: 0, state: 'quiet' as DerivedTaskState,
    };
    t.events += 1;
    if (e.event_type === 'tool_call') t.tool_calls += 1;
    if (e.success === false) t.failures += 1;
    t.tokens += e.total_tokens ?? 0;
    t.cost += e.estimated_cost ?? 0;
    if (parseUtc(e.timestamp) < parseUtc(t.first_seen)) t.first_seen = e.timestamp;
    if (parseUtc(e.timestamp) > parseUtc(t.last_seen)) t.last_seen = e.timestamp;
    if (e.event_type === 'task_end') t.state = 'finished';
    byTask.set(e.task_id, t);
  }
  for (const t of byTask.values()) {
    if (t.state !== 'finished') t.state = now - parseUtc(t.last_seen) < ACTIVE_WINDOW_MS ? 'active' : 'quiet';
  }
  const rank: Record<DerivedTaskState, number> = { active: 0, quiet: 1, finished: 2 };
  return [...byTask.values()].sort((a, b) => rank[a.state] - rank[b.state] || parseUtc(b.last_seen) - parseUtc(a.last_seen));
}
