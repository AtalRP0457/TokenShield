/**
 * TokenShield API contract (frontend side).
 *
 * EVERY shape the frontend expects from the FastAPI backend lives in this file.
 * Nothing else in the app declares response types, so when the backend's real
 * Pydantic models are finalised this is the ONE place to update.
 *
 * Status: PROPOSED CONTRACT — agree these shapes with the backend owner.
 * Field names use snake_case to match typical FastAPI/Pydantic output, so no
 * case-conversion layer is needed.
 */

/* ------------------------------------------------------------------ */
/* Shared enums                                                        */
/* ------------------------------------------------------------------ */

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

export type IncidentStatus = 'open' | 'investigating' | 'resolved';

export type TaskStatus = 'running' | 'completed' | 'failed' | 'stopped';

/** Who paused an agent: a person from the dashboard, or TokenShield enforcing a limit. */
export type PausedBy = 'user' | 'tokenshield';

/** What TokenShield tells an agent after it reports an event. */
export type AgentAction = 'continue' | 'stop';

/* ------------------------------------------------------------------ */
/* Agents                                                              */
/* ------------------------------------------------------------------ */

/** GET /api/agents  → Agent[] */
export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  status: AgentStatus;
  created_at: string; // ISO-8601
  last_seen_at: string; // ISO-8601
  total_tokens: number;
  total_cost_usd: number;
  tool_calls: number;
  failed_tool_calls: number;
  incident_count: number;
  /** Set while status is 'paused'. */
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

/** GET /api/agents/{agent_id}  → AgentDetail */
export interface AgentDetail extends Agent {
  current_tasks: AgentTask[];
}

/** POST /api/agents/register  (body) */
export interface RegisterAgentRequest {
  name: string;
  description?: string;
  model: string;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

/**
 * One telemetry event. Returned by GET /api/agents/{id}/events and pushed over
 * the WebSocket (if the backend provides one). Optional fields only appear on
 * the event types where they make sense.
 */
export interface AgentEvent {
  id: string;
  agent_id: string;
  agent_name: string;
  type: EventType;
  timestamp: string; // ISO-8601
  message: string;
  task_id?: string | null;
  tool_name?: string | null;
  success?: boolean | null;
  tokens?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
}

/** POST /api/events  (body) — what agents/SDKs send in. Not used by the UI directly. */
export type IngestEventRequest = Omit<AgentEvent, 'id' | 'agent_name'>;

/**
 * POST /api/events  (response). This is how TokenShield stops an agent:
 * agents check `action` after every event and end their task on 'stop'.
 */
export interface IngestEventResponse {
  event: AgentEvent;
  action: AgentAction;
  reason: string | null;
}

/** POST /api/agents/{agent_id}/pause  (body) → Agent.  POST /api/agents/{agent_id}/resume → Agent. */
export interface PauseAgentRequest {
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

/** GET /api/metrics/overview */
export interface MetricsOverview {
  active_agents: number;
  total_agents: number;
  total_tokens: number;
  total_cost_usd: number;
  wasted_cost_usd: number;
  loops_detected: number;
  active_incidents: number;
  successful_tool_calls: number;
  failed_tool_calls: number;
}

/** GET /api/metrics/tokens  → TokenMetricPoint[] (ordered oldest → newest) */
export interface TokenMetricPoint {
  timestamp: string;
  input_tokens: number;
  output_tokens: number;
}

/** GET /api/metrics/cost  → CostMetricPoint[] (ordered oldest → newest) */
export interface CostMetricPoint {
  timestamp: string;
  cost_usd: number;
  wasted_cost_usd: number;
}

/** GET /api/metrics/agents  → AgentMetric[] */
export interface AgentMetric {
  agent_id: string;
  agent_name: string;
  total_tokens: number;
  total_cost_usd: number;
  successful_tool_calls: number;
  failed_tool_calls: number;
}

/* ------------------------------------------------------------------ */
/* Incidents                                                           */
/* ------------------------------------------------------------------ */

/** GET /api/incidents → Incident[] ; GET /api/incidents/{id} → Incident */
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
  /** Natural-language root-cause analysis generated by Gemini. Null until generated. */
  gemini_explanation: string | null;
  recommended_actions: string[];
  /** IDs of the events that triggered this incident. */
  related_event_ids: string[];
  /** True when TokenShield stopped the agent automatically for this incident. */
  agent_stopped: boolean;
}

/** PATCH /api/incidents/{id}  (body) */
export interface UpdateIncidentRequest {
  status: IncidentStatus;
}

/* ------------------------------------------------------------------ */
/* Simulation & health                                                 */
/* ------------------------------------------------------------------ */

export type SimulationScenario = 'execution_loop' | 'failure_storm' | 'token_spike';

/** POST /api/simulation/trigger (body) */
export interface TriggerSimulationRequest {
  scenario: SimulationScenario;
}

/** Response of POST /api/simulation/start | stop | trigger */
export interface SimulationStatus {
  running: boolean;
  message: string;
}

/** GET /api/health */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  version?: string;
}
