import type { AgentGuards, GuardValues, Incident } from '../types/api';

export interface QuickFix {
  title: string;
  /** Plain-words reason, shown above the Apply button. */
  why: string;
  /** Merged into the hero's current guards when applied. */
  patch: Partial<GuardValues>;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Current effective value of a guard (override, else global default). */
function effective(g: AgentGuards, key: keyof GuardValues) {
  return g[key] ?? g.defaults[key];
}

/**
 * Athena's quick fix: one concrete budget change for this hero, derived from the
 * incident's evidence. Applying it calls PUT /api/agents/{id}/guards, which the
 * backend's detection uses on the very next event.
 */
export function quickFixFor(i: Incident, g: AgentGuards): QuickFix | null {
  const ev = i.evidence ?? {};
  switch (i.incident_type) {
    case 'REPEATED_TOOL_CALL':
    case 'SEQUENCE_LOOP': {
      const now = effective(g, 'max_repeated_calls');
      const next = Math.max(2, Math.min(3, now - 1));
      if (next >= now) return null;
      return {
        title: `Stop this hero after ${next} identical calls (now ${now})`,
        why: 'It will be paused sooner the next time it starts repeating itself, so less money is wasted.',
        patch: { max_repeated_calls: next },
      };
    }
    case 'CONSECUTIVE_FAILURES': {
      const now = effective(g, 'max_consecutive_failures');
      const next = Math.max(2, Math.min(3, now - 1));
      if (next >= now) return null;
      return {
        title: `Pause after ${next} failures in a row (now ${now})`,
        why: 'When the service it depends on is down, it will stop trying much sooner.',
        patch: { max_consecutive_failures: next },
      };
    }
    case 'TOKEN_BUDGET_EXCEEDED': {
      const now = effective(g, 'max_task_tokens');
      const used = num(ev.tokens_used) ?? num(ev.total_tokens);
      const next = Math.max(1000, Math.round((used ? Math.min(used, now) : now) * 0.6 / 1000) * 1000);
      if (next >= now) return null;
      return {
        title: `Lower this hero's token budget to ${next.toLocaleString('en-US')} per task`,
        why: 'Tasks that start eating too much text get paused before they become expensive.',
        patch: { max_task_tokens: next },
      };
    }
    case 'COST_BUDGET_EXCEEDED':
    case 'HIGH_SPENDING': {
      const now = effective(g, 'max_task_cost');
      const next = Math.max(0.05, +(now * 0.5).toFixed(2));
      if (next >= now) return null;
      return {
        title: `Lower this hero's budget to $${next.toFixed(2)} per task`,
        why: 'It will be paused at half the current spend limit.',
        patch: { max_task_cost: next },
      };
    }
    default:
      return null;
  }
}
