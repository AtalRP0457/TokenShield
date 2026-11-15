import type { AgentEvent } from '../types/api';
import { parseUtc } from './format';

export interface EventBucket {
  t: number;
  tokens: number;
  cost: number;
}

/**
 * Groups one agent's events into time buckets for its token and cost charts.
 * Bucket size adapts to the time span so the chart always has ~12–24 points.
 */
export function bucketEvents(events: AgentEvent[], now = Date.now()): EventBucket[] {
  if (events.length === 0) return [];
  const oldest = Math.min(...events.map((e) => parseUtc(e.timestamp)));
  const span = Math.max(now - oldest, 60_000);
  const steps = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 3_600_000, 6 * 3_600_000];
  const size = steps.find((s) => span / s <= 24) ?? steps[steps.length - 1];

  const end = Math.ceil(now / size) * size;
  const count = Math.min(48, Math.max(6, Math.ceil((end - oldest) / size)));
  const start = end - count * size;

  const buckets: EventBucket[] = Array.from({ length: count }, (_, i) => ({ t: start + i * size, tokens: 0, cost: 0 }));
  for (const e of events) {
    const idx = Math.floor((parseUtc(e.timestamp) - start) / size);
    if (idx < 0 || idx >= count) continue;
    buckets[idx].tokens += e.total_tokens ?? 0;
    buckets[idx].cost += e.estimated_cost ?? 0;
  }
  return buckets;
}
