/**
 * Internal state shapes for the in-browser mock backend.
 *
 * These are PRIVATE to services/mock/. The simulator keeps a little more
 * state than the API exposes (per-task budgets, profiles, explanations); the
 * mock converts everything to the real contract types (types/api.ts) at the
 * API boundary in mockApi.ts, so the rest of the app only ever sees v2 shapes.
 */

export type AgentStatus = 'active' | 'idle' | 'paused' | 'error';

export type EventType =
  | 'tool_call'
  | 'api_failure'
  | 'token_usage'
  | 'repeated_call'
  | 'task_started'
  | 'task_completed'
  | 'agent_stopped'
  | 'agent_resumed';

export type IncidentType =
  | 'execution_loop'
  | 'repeated_tool_calls'
  | 'consecutive_failures'
  | 'token_limit_exceeded'
  | 'cost_limit_exceeded'
  | 'task_timeout';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';
export type TaskStatus = 'running' | 'completed' | 'failed' | 'stopped';
export type PausedBy = 'user' | 'tokenshield';
export type AgentAction = 'continue' | 'stop';

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  status: AgentStatus;
  created_at: string;
  last_seen_at: string;
  total_tokens: number;
  total_cost_usd: number;
  tool_calls: number;
  failed_tool_calls: number;
  incident_count: number;
  paused_by: PausedBy | null;
  pause_reason: string | null;
}

export interface AgentTask {
  id: string;
  name: string;
  status: TaskStatus;
  started_at: string;
  tokens_used: number;
  cost_usd: number;
  tool_calls: number;
}

export interface AgentEvent {
  id: string;
  agent_id: string;
  agent_name: string;
  type: EventType;
  timestamp: string;
  message: string;
  task_id?: string | null;
  tool_name?: string | null;
  success?: boolean | null;
  tokens?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
}

export interface Incident {
  id: string;
  agent_id: string;
  agent_name: string;
  type: IncidentType;
  severity: Severity;
  status: IncidentStatus;
  title: string;
  description: string;
  estimated_waste_usd: number;
  detected_at: string;
  resolved_at: string | null;
  gemini_explanation: string | null;
  recommended_actions: string[];
  related_event_ids: string[];
  agent_stopped: boolean;
}

export interface TokenMetricPoint {
  timestamp: string;
  input_tokens: number;
  output_tokens: number;
}

export interface CostMetricPoint {
  timestamp: string;
  cost_usd: number;
  wasted_cost_usd: number;
}
