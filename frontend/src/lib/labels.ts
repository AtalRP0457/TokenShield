/**
 * Display metadata for API enums: human labels, icons, colours and the
 * Odyssey "peril" names. A new enum value from the backend is a one-line change.
 */
import {
  Activity, CheckCircle2, CloudLightning, Flame, Music, PlayCircle, ShieldCheck, ShieldX, Sparkles, Sun, Tornado, TreePalm, Wind, Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AgentStatus, AnalysisSeverity, IncidentStatus, IncidentType } from '../types/api';
import { humanize } from './format';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'critical';

export const AGENT_STATUS: Record<AgentStatus, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'critical' },
  stopped: { label: 'Stopped', tone: 'neutral' },
};

/** Includes "low" because Gemini's own severity scale has it. */
export const SEVERITY: Record<AnalysisSeverity, { label: string; tone: Tone; rank: number }> = {
  critical: { label: 'Critical', tone: 'critical', rank: 4 },
  high: { label: 'High', tone: 'danger', rank: 3 },
  medium: { label: 'Medium', tone: 'warning', rank: 2 },
  low: { label: 'Low', tone: 'neutral', rank: 1 },
};

export const INCIDENT_STATUS: Record<IncidentStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'danger' },
  acknowledged: { label: 'Acknowledged', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
};

export interface PerilMeta {
  /** Plain-English name — always shown next to the myth. */
  label: string;
  /** The Odyssey peril. */
  peril: string;
  icon: LucideIcon;
  /** One line tying the myth to the failure mode. */
  lore: string;
}

/** Each backend incident type is a peril from the Odyssey. */
export const INCIDENT_TYPE: Record<IncidentType, PerilMeta> = {
  REPEATED_TOOL_CALL: {
    label: 'Repeated tool call', peril: 'The Sirens', icon: Music,
    lore: 'A song that lures sailors back again and again: the agent keeps calling the same tool with the same arguments.',
  },
  SEQUENCE_LOOP: {
    label: 'Sequence loop', peril: 'Charybdis', icon: Tornado,
    lore: 'The whirlpool that swallows ships whole: the agent circles through the same steps and never gets anywhere.',
  },
  CONSECUTIVE_FAILURES: {
    label: 'Consecutive failures', peril: "Poseidon's storm", icon: CloudLightning,
    lore: 'Wave after wave breaks over the ship: one failure after another, with no change of course.',
  },
  TOKEN_BUDGET_EXCEEDED: {
    label: 'Token budget exceeded', peril: "Aeolus' winds", icon: Wind,
    lore: 'The bag of winds opened all at once: a burst of tokens that blows the task far off course.',
  },
  COST_BUDGET_EXCEEDED: {
    label: 'Cost budget exceeded', peril: 'Cattle of Helios', icon: Sun,
    lore: 'The crew consumed what was forbidden and paid dearly: spend has gone past the budget.',
  },
  HIGH_SPENDING: {
    label: 'High spending', peril: 'Scylla', icon: Flame,
    lore: 'The six-headed monster that took a sailor with every head: spend is being devoured far faster than normal.',
  },
  LONG_RUNNING_TASK: {
    label: 'Long-running task', peril: "Calypso's isle", icon: TreePalm,
    lore: 'Odysseus was held there for seven years: the task is stuck and will not finish on its own.',
  },
};

/** Fallback for an incident type the backend adds later. */
export function perilFor(type: string): PerilMeta {
  return INCIDENT_TYPE[type as IncidentType] ?? { label: humanize(type), peril: humanize(type), icon: Sparkles, lore: '' };
}

const EVENT_TYPE: Record<string, { label: string; icon: LucideIcon; tone: Tone }> = {
  tool_call: { label: 'Tool call', icon: Wrench, tone: 'info' },
  llm_call: { label: 'LLM call', icon: Sparkles, tone: 'neutral' },
  task_start: { label: 'Task started', icon: PlayCircle, tone: 'neutral' },
  task_end: { label: 'Task finished', icon: CheckCircle2, tone: 'success' },
  agent_paused: { label: 'Agent paused', icon: ShieldX, tone: 'critical' },
  agent_resumed: { label: 'Agent resumed', icon: ShieldCheck, tone: 'success' },
};

/** Label/icon/tone for any `event_type` string, with a readable fallback for unknown types. */
export function eventMeta(eventType: string): { label: string; icon: LucideIcon; tone: Tone } {
  return EVENT_TYPE[eventType] ?? { label: humanize(eventType), icon: Activity, tone: 'neutral' };
}

/** Tailwind classes per tone: subtle tinted background + readable text + border. */
export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-zinc-500/10 text-zinc-300 ring-zinc-500/20',
  info: 'bg-blue-500/10 text-blue-300 ring-blue-500/25',
  success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
  warning: 'bg-amber-500/10 text-amber-300 ring-amber-500/25',
  danger: 'bg-red-500/10 text-red-300 ring-red-500/25',
  critical: 'bg-red-500/20 text-red-200 ring-red-500/50',
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-zinc-400',
  info: 'bg-blue-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
  critical: 'bg-red-500',
};

/** Simulated agents are named "[SIM] …" by the backend; the SIMULATED badge says it instead. */
export const displayAgentName = (name: string) => name.replace(/^\[SIM\]\s*/i, '');
