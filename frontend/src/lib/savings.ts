import type { Incident } from '../types/api';

/**
 * How much longer a caught loop would have kept running without TokenShield,
 * as a multiple of what it had already wasted. Deliberately conservative:
 * a loop left alone usually runs until a human notices (often hours).
 */
export const PROJECTION_MULTIPLIER = 5;

export interface Savings {
  /** Waste the perils had already caused before the pause. */
  caught: number;
  /** Estimated spend avoided by pausing. */
  saved: number;
  perils: number;
}

/** Only one incident per task counts (several rules can fire on the same loop). */
export function estimateSavings(incidents: Incident[], multiplier = PROJECTION_MULTIPLIER): Savings {
  const perTask = new Map<string, number>();
  for (const i of incidents) {
    const key = i.task_id ?? i.id;
    perTask.set(key, Math.max(perTask.get(key) ?? 0, i.estimated_waste));
  }
  const caught = [...perTask.values()].reduce((s, v) => s + v, 0);
  return { caught, saved: caught * multiplier, perils: incidents.length };
}
