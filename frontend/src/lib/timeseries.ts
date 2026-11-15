import type { TimeseriesPoint } from '../types/api';
import { parseUtc } from './format';

export interface ChartPoint {
  /** Epoch ms, for the x axis. */
  t: number;
  calls: number;
  successful: number;
  failures: number;
  tokens: number;
  cost: number;
}

/**
 * The API omits minutes with no events. Charts need a continuous axis, so
 * build every minute in the window and fill the missing ones with zeros.
 * Buckets wider than one minute are used for long windows to keep charts readable.
 */
export function fillTimeseries(series: TimeseriesPoint[], minutes: number, now = Date.now()): ChartPoint[] {
  const step = minutes <= 120 ? 1 : minutes <= 360 ? 5 : 15; // minutes per bucket
  const stepMs = step * 60_000;
  const end = Math.floor(now / stepMs) * stepMs;
  const start = end - Math.ceil(minutes / step - 1) * stepMs;

  const points = new Map<number, ChartPoint>();
  for (let t = start; t <= end; t += stepMs) points.set(t, { t, calls: 0, successful: 0, failures: 0, tokens: 0, cost: 0 });

  for (const p of series) {
    const t = Math.floor(parseUtc(p.time) / stepMs) * stepMs;
    const bucket = points.get(t);
    if (!bucket) continue;
    bucket.calls += p.calls;
    bucket.failures += p.failures;
    bucket.tokens += p.tokens;
    bucket.cost += p.cost;
  }
  for (const b of points.values()) b.successful = Math.max(0, b.calls - b.failures);
  return [...points.values()];
}
