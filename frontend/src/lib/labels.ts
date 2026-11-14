/**
 * Display metadata for API enums: human labels, icons and colour classes.
 * Keeping it here means a new enum value from the backend is a one-line change.
 */
import {
  Activity, AlertOctagon, CheckCircle2, Clock, Coins, DollarSign, PlayCircle, Repeat, RotateCw, Wrench, XCircle, Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AgentStatus, EventType, IncidentStatus, IncidentType, Severity, TaskStatus } from '../types/api';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'critical';

export const AGENT_STATUS: Record<AgentStatus, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  idle: { label: 'Idle', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'warning' },
  error: { label: 'Error', tone: 'danger' },
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  running: { label: 'Running', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  stopped: { label: 'Stopped', tone: 'warning' },
};

export const SEVERITY: Record<Severity, { label: string; tone: Tone; rank: number }> = {
  critical: { label: 'Critical', tone: 'critical', rank: 4 },
  high: { label: 'High', tone: 'danger', rank: 3 },
  medium: { label: 'Medium', tone: 'warning', rank: 2 },
  low: { label: 'Low', tone: 'neutral', rank: 1 },
};

export const INCIDENT_STATUS: Record<IncidentStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'danger' },
  investigating: { label: 'Investigating', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
};

export const INCIDENT_TYPE: Record<IncidentType, { label: string; icon: LucideIcon }> = {
  execution_loop: { label: 'Execution loop', icon: RotateCw },
  repeated_tool_calls: { label: 'Repeated tool calls', icon: Repeat },
  consecutive_failures: { label: 'Consecutive failures', icon: XCircle },
  token_limit_exceeded: { label: 'Token limit exceeded', icon: Coins },
  cost_limit_exceeded: { label: 'Cost limit exceeded', icon: DollarSign },
  task_timeout: { label: 'Task timeout', icon: Clock },
};

export const EVENT_TYPE: Record<EventType, { label: string; icon: LucideIcon; tone: Tone }> = {
  tool_call: { label: 'Tool call', icon: Wrench, tone: 'info' },
  api_failure: { label: 'API failure', icon: AlertOctagon, tone: 'danger' },
  token_usage: { label: 'Token usage', icon: Zap, tone: 'neutral' },
  repeated_call: { label: 'Repeated call', icon: Repeat, tone: 'warning' },
  task_started: { label: 'Task started', icon: PlayCircle, tone: 'neutral' },
  task_completed: { label: 'Task completed', icon: CheckCircle2, tone: 'success' },
};

export const FALLBACK_EVENT = { label: 'Event', icon: Activity, tone: 'neutral' as Tone };

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
