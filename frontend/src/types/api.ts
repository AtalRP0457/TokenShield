/**
 * TokenShield API contract v2 — mirrors the FastAPI backend exactly.
 *
 * EVERY response shape the frontend reads lives in this file. Field names and
 * enums are copied from the backend contract; nothing here is invented. If the
 * backend changes, update this file and TypeScript points at every call site.
 *
 * Notes from the contract:
 *  - Timestamps are UTC ISO-8601. Parse with parseUtc() in lib/format.ts.
 *  - ALL costs are estimates (not provider billing) — label them as such.
 *  - There is no WebSocket: poll /api/events/recent and /api/incidents every 2–3 s.
 */

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

/** GET /api/metrics/overview */
export interface MetricsOverview {
  active_agents: number;
  total_tokens: number;
  estimated_cost: number;
  potential_waste: number;
  detected_loops: number;
  active_incidents: number;
  cost_is_estimate: boolean;
}

/* ------------------------------------------------------------------ */
/* Charts (Tiger Data / Timescale continuous aggregate)                */
/* ------------------------------------------------------------------ */

export interface ValuePoint {
  time: string;
  value: number;
}

/** GET /api/metrics/tokens?minutes=N */
export interface TokenSeriesResponse {
  series: ValuePoint[];
  source: string;
}

/** GET /api/metrics/cost?minutes=N */
export interface CostSeriesResponse {
  series: ValuePoint[];
  is_estimate: boolean;
  source: string;
}

export interface TimeseriesPoint {
  time: string;
  calls: number;
  tokens: number;
  cost: number;
  failures: number;
}

/**
 * GET /api/metrics/timeseries?minutes=N — tokens, cost, calls, failures in one call.
 * Minutes with no events are MISSING from `series`; fill them with 0 (lib/timeseries.ts).
 */
export interface TimeseriesResponse {
  series: TimeseriesPoint[];
  is_estimate: boolean;
  source: string;
}

/* ------------------------------------------------------------------ */
/* Agents                                                              */
/* ------------------------------------------------------------------ */

export type AgentStatus = 'active' | 'paused' | 'stopped';

/** GET /api/agents  (same data: GET /api/metrics/agents) ; GET /api/agents/{id} */
export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  is_simulated: boolean;
  created_at: string;
  last_seen: string;
  total_tokens: number;
  estimated_cost: number;
  open_incidents: number;
}

/** POST /api/agents — add a hero from the dashboard. */
export interface CreateAgentRequest {
  name: string;
  description: string;
}

/** POST /api/agents/{id}/test-failure */
export interface TestFailureResponse {
  event_id: string;
  agent_status: AgentStatus;
  should_stop: boolean;
  new_incident_ids: string[];
}

/** POST /api/agents/{id}/resume */
export interface ResumeAgentResponse {
  agent_id: string;
  status: AgentStatus;
}

/* ------------------------------------------------------------------ */
/* Events (live activity feed)                                         */
/* ------------------------------------------------------------------ */

/**
 * GET /api/events/recent?limit=50 (newest first) and GET /api/agents/{id}/events?limit=100.
 * `event_type` is a string; "tool_call" is the documented value — the UI
 * renders any other value with a readable fallback label.
 */
export interface AgentEvent {
  id: string;
  agent_id: string;
  task_id: string | null;
  event_type: string;
  tool_name: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  success: boolean | null;
  error_message: string | null;
  duration_ms: number | null;
  is_simulated: boolean;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Incidents                                                           */
/* ------------------------------------------------------------------ */

export type IncidentType =
  | 'REPEATED_TOOL_CALL'
  | 'CONSECUTIVE_FAILURES'
  | 'SEQUENCE_LOOP'
  | 'TOKEN_BUDGET_EXCEEDED'
  | 'COST_BUDGET_EXCEEDED'
  | 'HIGH_SPENDING'
  | 'LONG_RUNNING_TASK';

export type Severity = 'medium' | 'high' | 'critical';

/** Gemini's own severity scale also includes "low". */
export type AnalysisSeverity = 'low' | Severity;

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

/** Null until Gemini finishes (usually 2–10 s after the incident appears), and null if Gemini fails. */
export interface GeminiAnalysis {
  summary: string;
  probable_root_cause: string;
  severity: AnalysisSeverity;
  /** 0–1; display as a percentage. */
  confidence: number;
  evidence: string[];
  recommended_actions: string[];
  estimated_wasted_resources: string;
  additional_investigation: string[];
  /** 2–3 sentences anyone can follow. Missing on analyses made before this field existed. */
  plain_explanation?: string;
  /** Demo site only: true when this is pre-written sample text, not a live Gemini answer. */
  is_sample?: boolean;
}

/** GET /api/incidents?status=…  (newest first) ; GET /api/incidents/{id} */
export interface Incident {
  id: string;
  agent_id: string;
  agent_name: string;
  task_id: string | null;
  incident_type: IncidentType;
  severity: Severity;
  description: string;
  /** Free-form; keys depend on incident_type. Render as key/value pairs. */
  evidence: Record<string, unknown>;
  /** Null for incident types that are not repeated-call loops. */
  repeated_calls: number | null;
  estimated_waste: number;
  gemini_analysis: GeminiAnalysis | null;
  status: IncidentStatus;
  created_at: string;
}

/** PATCH /api/incidents/{id} */
export interface UpdateIncidentRequest {
  status: IncidentStatus;
}

/* ------------------------------------------------------------------ */
/* Demo controls & health                                              */
/* ------------------------------------------------------------------ */

export type SimulationScenario = 'healthy' | 'repeating' | 'token_heavy' | 'failing' | 'sequence_loop';

/** POST /api/simulation/trigger?scenario=… */
export interface TriggerSimulationResponse {
  started: SimulationScenario;
  simulated: boolean;
}

/** POST /api/simulation/start (runs all five) */
export interface StartSimulationResponse {
  started: SimulationScenario[];
  simulated: boolean;
}

/** POST /api/simulation/stop */
export interface StopSimulationResponse {
  stopped: boolean;
}

/** GET /api/health */
export interface HealthResponse {
  status: string;
  environment: string;
}

/* ------------------------------------------------------------------ */
/* Per-hero budgets, Oracle, alert channels                            */
/* ------------------------------------------------------------------ */

export interface GuardValues {
  max_task_tokens: number | null;
  max_task_cost: number | null;
  max_repeated_calls: number | null;
  max_consecutive_failures: number | null;
}

/** GET/PUT /api/agents/{id}/guards — null means "use the global default". */
export interface AgentGuards extends GuardValues {
  agent_id: string;
  defaults: { max_task_tokens: number; max_task_cost: number; max_repeated_calls: number; max_consecutive_failures: number };
}

/** POST /api/oracle/ask */
export interface OracleAnswer {
  answer: string;
  key_points: string[];
  next_step: string;
  source: 'gemini' | 'rules';
}

/** GET /api/notifications/status */
export interface NotificationStatus {
  discord: boolean;
  slack: boolean;
  email: boolean;
  gemini: boolean;
}
