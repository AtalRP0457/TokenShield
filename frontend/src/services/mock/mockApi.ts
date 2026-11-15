/**
 * In-browser mock backend that speaks the real API contract (v2).
 *
 * Internally it keeps richer state (see mockTypes.ts) and runs a simulator;
 * every public method converts that state to the exact v2 shapes in
 * types/api.ts, so mock mode and the FastAPI backend are interchangeable.
 *
 * It also enforces the protection limits like the backend does: when an agent
 * breaks one, it raises an incident and pauses the agent. Gemini analysis
 * appears a few seconds after an incident, like the real backend.
 *
 * Nothing persists: reload the page to reset.
 */
import type { TokenShieldApi } from '../apiClient';
import { ApiError } from '../http';
import { loadSettings } from '../settingsStorage';
import { plainFor, plainSentence } from '../../lib/plain';
import type { ProtectionSettings } from '../../types/settings';
import type * as V2 from '../../types/api';
import type {
  Agent,
  AgentAction,
  AgentEvent,
  AgentTask,
  Incident,
  IncidentType,
  Severity,
} from './mockTypes';
import {
  buildEvent,
  createRng,
  nextEventId,
  profileById,
  seedAgents,
  seedEvents,
  seedIncidents,
  seedTasks,
} from './mockData';

const MAX_EVENTS = 3_000;
const TICK_MS = 2_200;
/** How long a new incident shows "Analyzing…" before its Gemini analysis appears. */
const ANALYSIS_DELAY_MS = 4_000;

/* ---------------- state ---------------- */

const rng = createRng(20261114);
const agents: Agent[] = seedAgents();
const tasks: Record<string, AgentTask[]> = seedTasks(rng);
const events: AgentEvent[] = seedEvents(rng, agents); // newest first
const incidents: Incident[] = seedIncidents(events);
let simulationRunning = true;
let incidentSeq = 1043;

/** Evidence objects captured when an incident is opened (keys depend on type). */
const evidenceById: Record<string, Record<string, unknown>> = {};
/** When each incident's Gemini analysis becomes available. */
const analysisReadyAt: Record<string, number> = {};

/** Per-hero budget overrides (PUT /api/agents/{id}/guards). */
const guardsById: Record<string, V2.GuardValues> = {};

function guardDefaults(): V2.AgentGuards['defaults'] {
  const l = loadSettings();
  return { max_task_tokens: l.maxTokensPerTask, max_task_cost: l.maxCostPerTaskUsd, max_repeated_calls: l.maxRepeatedToolCalls, max_consecutive_failures: l.maxConsecutiveFailures };
}

/** Global limits with this hero's overrides applied. */
function limitsFor(agentId: string): ProtectionSettings {
  const l = loadSettings();
  const g = guardsById[agentId];
  if (!g) return l;
  return {
    ...l,
    maxTokensPerTask: g.max_task_tokens ?? l.maxTokensPerTask,
    maxCostPerTaskUsd: g.max_task_cost ?? l.maxCostPerTaskUsd,
    maxRepeatedToolCalls: g.max_repeated_calls ?? l.maxRepeatedToolCalls,
    maxConsecutiveFailures: g.max_consecutive_failures ?? l.maxConsecutiveFailures,
  };
}

function toGuards(agentId: string): V2.AgentGuards {
  const g = guardsById[agentId] ?? { max_task_tokens: null, max_task_cost: null, max_repeated_calls: null, max_consecutive_failures: null };
  return { agent_id: agentId, defaults: guardDefaults(), ...g };
}

/** Per-agent streak counters used by enforce(). */
const streaks: Record<string, { failures: AgentEvent[]; repeats: AgentEvent[] }> = {};
const streakFor = (id: string) => (streaks[id] ??= { failures: [], repeats: [] });

/* ---------------- helpers ---------------- */

const clone = <T,>(value: T): T => structuredClone(value);
const delay = (ms = 120 + Math.random() * 280) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const sumCost = (evts: AgentEvent[]) => evts.reduce((s, e) => s + (e.cost_usd ?? 0), 0);
const isToolEvent = (e: AgentEvent) => e.type === 'tool_call' || e.type === 'api_failure' || e.type === 'repeated_call';

async function respond<T>(produce: () => T, ms?: number): Promise<T> {
  await delay(ms);
  return clone(produce());
}

function findAgent(id: string): Agent {
  const agent = agents.find((a) => a.id === id);
  if (!agent) throw new ApiError(`404 Agent ${id} not found`, `/api/agents/${id}`, 404);
  return agent;
}

function findIncident(id: string): Incident {
  const incident = incidents.find((i) => i.id === id);
  if (!incident) throw new ApiError(`404 Incident ${id} not found`, `/api/incidents/${id}`, 404);
  return incident;
}

/* ---------------- converting internal state → contract v2 ---------------- */

const INCIDENT_TYPE_V2: Record<IncidentType, V2.IncidentType> = {
  execution_loop: 'SEQUENCE_LOOP',
  repeated_tool_calls: 'REPEATED_TOOL_CALL',
  consecutive_failures: 'CONSECUTIVE_FAILURES',
  token_limit_exceeded: 'TOKEN_BUDGET_EXCEEDED',
  cost_limit_exceeded: 'COST_BUDGET_EXCEEDED',
  task_timeout: 'LONG_RUNNING_TASK',
};

const EVENT_TYPE_V2: Record<AgentEvent['type'], string> = {
  tool_call: 'tool_call',
  api_failure: 'tool_call',
  repeated_call: 'tool_call',
  token_usage: 'llm_call',
  task_started: 'task_start',
  task_completed: 'task_end',
  agent_stopped: 'agent_paused',
  agent_resumed: 'agent_resumed',
};

function toAgentV2(a: Agent): V2.Agent {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    status: a.status === 'paused' ? 'paused' : a.status === 'idle' ? 'stopped' : 'active',
    is_simulated: true,
    created_at: a.created_at,
    last_seen: a.last_seen_at,
    total_tokens: a.total_tokens,
    estimated_cost: +a.total_cost_usd.toFixed(4),
    open_incidents: incidents.filter((i) => i.agent_id === a.id && i.status !== 'resolved').length,
  };
}

function toEventV2(e: AgentEvent): V2.AgentEvent {
  const tokens = e.tokens ?? null;
  const input = tokens != null ? Math.round(tokens * 0.7) : null;
  const failed = e.success === false;
  return {
    id: e.id,
    agent_id: e.agent_id,
    task_id: e.task_id ?? null,
    event_type: EVENT_TYPE_V2[e.type] ?? e.type,
    tool_name: e.tool_name ?? null,
    model: agents.find((a) => a.id === e.agent_id)?.model ?? null,
    input_tokens: input,
    output_tokens: tokens != null && input != null ? tokens - input : null,
    total_tokens: tokens,
    estimated_cost: e.cost_usd ?? null,
    success: e.success ?? null,
    error_message: failed ? (e.message.split(': ').slice(1).join(': ') || e.message) : null,
    duration_ms: e.latency_ms ?? null,
    is_simulated: true,
    timestamp: e.timestamp,
  };
}

function evidenceFor(i: Incident): Record<string, unknown> {
  if (evidenceById[i.id]) return evidenceById[i.id];
  const related = events.filter((e) => i.related_event_ids.includes(e.id));
  const failed = related.filter((e) => e.success === false);
  const tool = related.find((e) => e.tool_name)?.tool_name;
  return {
    ...(tool ? { tool_name: tool } : {}),
    related_events: i.related_event_ids.length,
    failed_calls: failed.length,
    ...(failed[0] ? { last_error: toEventV2(failed[0]).error_message } : {}),
  };
}

function toIncidentV2(i: Incident): V2.Incident {
  const type = INCIDENT_TYPE_V2[i.type];
  const ready = Date.now() >= (analysisReadyAt[i.id] ?? 0);
  const evidence = evidenceFor(i);
  return {
    id: i.id,
    agent_id: i.agent_id,
    agent_name: i.agent_name,
    task_id: events.find((e) => i.related_event_ids.includes(e.id))?.task_id ?? null,
    incident_type: type,
    severity: i.severity === 'low' ? 'medium' : i.severity,
    description: i.description,
    evidence,
    repeated_calls: type === 'REPEATED_TOOL_CALL' || type === 'SEQUENCE_LOOP' ? Number(evidence.repeated_calls ?? i.related_event_ids.length) : null,
    estimated_waste: +i.estimated_waste_usd.toFixed(4),
    gemini_analysis:
      ready && i.gemini_explanation
        ? {
            summary: i.title,
            probable_root_cause: i.gemini_explanation,
            severity: i.severity,
            confidence: 0.82 + ((i.id.charCodeAt(i.id.length - 1) % 7) / 50),
            evidence: [i.description],
            recommended_actions: i.recommended_actions,
            estimated_wasted_resources: `About $${i.estimated_waste_usd.toFixed(2)} (estimated) in tokens and tool calls`,
            additional_investigation: ['Check whether the same pattern appeared in earlier runs of this task.'],
            plain_explanation: plainSentence(type),
          }
        : null,
    status: i.status,
    created_at: i.detected_at,
  };
}

/* ---------------- aggregates ---------------- */

function applyEvent(event: AgentEvent): { tokensBefore: number; task?: AgentTask } {
  events.unshift(event);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;

  const agent = agents.find((a) => a.id === event.agent_id);
  const task = agent ? tasks[agent.id]?.find((t) => t.id === event.task_id) : undefined;
  const tokensBefore = task?.tokens_used ?? 0;

  if (agent) {
    agent.last_seen_at = event.timestamp;
    agent.total_tokens += event.tokens ?? 0;
    agent.total_cost_usd = +(agent.total_cost_usd + (event.cost_usd ?? 0)).toFixed(4);
    if (isToolEvent(event)) {
      agent.tool_calls += 1;
      if (event.success === false) agent.failed_tool_calls += 1;
    }
    if (task) {
      if (event.type === 'task_started') task.status = 'running';
      if (event.type === 'task_completed') task.status = 'completed';
      task.tokens_used += event.tokens ?? 0;
      task.cost_usd = +(task.cost_usd + (event.cost_usd ?? 0)).toFixed(4);
      if (event.tool_name) task.tool_calls += 1;
    }
  }
  return { tokensBefore, task };
}

function openIncident(
  agent: Agent, type: IncidentType, severity: Severity, title: string, description: string,
  waste: number, related: AgentEvent[], explanation: string, actions: string[], evidence: Record<string, unknown>,
) {
  const incident: Incident = {
    id: `INC-${(incidentSeq++).toString(16).toUpperCase().padStart(6, '0')}`,
    agent_id: agent.id,
    agent_name: agent.name,
    type,
    severity,
    status: 'open',
    title,
    description,
    estimated_waste_usd: +waste.toFixed(4),
    detected_at: nowIso(),
    resolved_at: null,
    gemini_explanation: explanation,
    recommended_actions: actions,
    related_event_ids: related.map((e) => e.id),
    agent_stopped: true,
  };
  incidents.unshift(incident);
  agent.incident_count += 1;
  evidenceById[incident.id] = evidence;
  analysisReadyAt[incident.id] = Date.now() + ANALYSIS_DELAY_MS;
  return incident;
}

/* ---------------- pause / resume ---------------- */

function pause(agent: Agent, reason: string) {
  if (agent.status === 'paused') return;
  agent.status = 'paused';
  agent.paused_by = 'tokenshield';
  agent.pause_reason = reason;
  tasks[agent.id]?.forEach((t) => t.status === 'running' && (t.status = 'stopped'));
  delete streaks[agent.id];
  applyEvent({
    id: nextEventId(), agent_id: agent.id, agent_name: agent.name, type: 'agent_stopped', timestamp: nowIso(),
    message: `TokenShield paused this agent: ${reason}`,
  });
}

function resume(agent: Agent) {
  if (agent.status !== 'paused') return;
  agent.status = 'active';
  agent.paused_by = null;
  agent.pause_reason = null;
  tasks[agent.id]?.forEach((t) => t.status === 'stopped' && (t.status = 'running'));
  delete streaks[agent.id];
  applyEvent({
    id: nextEventId(), agent_id: agent.id, agent_name: agent.name, type: 'agent_resumed', timestamp: nowIso(),
    message: 'Resumed from the dashboard',
  });
}

/* ---------------- enforcement (mirrors the backend's detection) ---------------- */

function ingest(event: AgentEvent): { action: AgentAction; reason: string | null } {
  const agent = agents.find((a) => a.id === event.agent_id);
  if (agent?.status === 'paused') return { action: 'stop', reason: agent.pause_reason };
  const { tokensBefore, task } = applyEvent(event);
  if (!agent) return { action: 'continue', reason: null };
  return enforce(agent, event, tokensBefore, task);
}

function enforce(agent: Agent, event: AgentEvent, tokensBefore: number, task?: AgentTask): { action: AgentAction; reason: string | null } {
  const limits = limitsFor(agent.id);
  const s = streakFor(agent.id);

  if (isToolEvent(event)) {
    if (event.success === false) s.failures.push(event);
    else s.failures = [];
    if (event.type === 'repeated_call') s.repeats.push(event);
    else s.repeats = [];
  }

  if (s.repeats.length >= limits.maxRepeatedToolCalls) {
    const tool = event.tool_name ?? 'a tool';
    const evts = [...s.repeats];
    const failed = evts.filter((e) => e.success === false);
    const reason = `${tool} repeated ${evts.length}× with identical arguments`;
    openIncident(agent, 'repeated_tool_calls', 'high', `${tool} called ${evts.length} times with identical arguments`,
      `Tool '${tool}' was called ${evts.length} times in a row with identical arguments (${failed.length} failed).`,
      sumCost(evts) + 0.4, evts,
      `The agent retries ${tool} after each identical result instead of revising its plan. Every retry re-sends the conversation history, so cost grows with each loop.`,
      ['Review the step that keeps failing before resuming the agent.', `Cap ${tool} at ${limits.maxRepeatedToolCalls} identical calls per task.`, 'Add backoff, or change the arguments between retries.'],
      { tool_name: tool, repeated_calls: evts.length, failed_calls: failed.length, last_error: failed[0] ? toEventV2(failed[0]).error_message : null });
    pause(agent, reason);
    return { action: 'stop', reason };
  }

  if (s.failures.length >= limits.maxConsecutiveFailures) {
    const evts = [...s.failures];
    const reason = `${evts.length} consecutive failures`;
    openIncident(agent, 'consecutive_failures', 'high', `${evts.length} failures in a row`,
      `${agent.name} failed ${evts.length} tool or API calls in a row.`,
      sumCost(evts) + 0.2, evts,
      'An upstream dependency is failing and the agent retries immediately without backing off, spending tokens on steps that cannot succeed.',
      ['Check the upstream service the agent depends on.', 'Add exponential backoff with jitter to the failing tool.', 'Resume the agent once the service is healthy.'],
      { consecutive_failures: evts.length, last_error: toEventV2(evts[evts.length - 1]).error_message, tool_name: evts[evts.length - 1].tool_name ?? null });
    pause(agent, reason);
    return { action: 'stop', reason };
  }

  if (task && task.status === 'running' && tokensBefore <= limits.maxTokensPerTask && task.tokens_used > limits.maxTokensPerTask) {
    const reason = `task used ${task.tokens_used.toLocaleString('en-US')} tokens`;
    openIncident(agent, 'token_limit_exceeded', 'high', `Token budget exceeded on “${task.name}”`,
      `Task “${task.name}” used ${task.tokens_used.toLocaleString('en-US')} tokens, over the ${limits.maxTokensPerTask.toLocaleString('en-US')}-token budget.`,
      (event.cost_usd ?? 0) * 0.8 + 0.3, [event],
      'Large documents were placed directly into the prompt instead of being chunked and retrieved, so each completion used almost the full context window.',
      ['Chunk documents and retrieve only the relevant passages.', 'Keep the per-task token budget enabled.', 'Resume the agent after reducing prompt size.'],
      { task_name: task.name, tokens_used: task.tokens_used, token_budget: limits.maxTokensPerTask });
    pause(agent, reason);
    return { action: 'stop', reason };
  }

  return { action: 'continue', reason: null };
}

/* ---------------- simulator ---------------- */

function tick() {
  if (!simulationRunning) return;
  const live = agents.filter((a) => a.status === 'active' || a.status === 'error');
  if (live.length === 0) return;
  const agent = rng.pick(live);

  // Healthy agents finish tasks before hitting the budget, so background
  // traffic never trips the token rule on its own.
  const limit = limitsFor(agent.id).maxTokensPerTask;
  for (const task of tasks[agent.id] ?? []) {
    if (task.status !== 'running' || task.tokens_used <= limit * 0.6) continue;
    ingest({ id: nextEventId(), agent_id: agent.id, agent_name: agent.name, type: 'task_completed', task_id: task.id, success: true, timestamp: nowIso(), message: `Completed task “${task.name}”` });
    Object.assign(task, { status: 'running', tokens_used: 0, cost_usd: 0, tool_calls: 0, started_at: nowIso() });
    ingest({ id: nextEventId(), agent_id: agent.id, agent_name: agent.name, type: 'task_started', task_id: task.id, timestamp: nowIso(), message: `Started task “${task.name}”` });
  }

  ingest(buildEvent(rng, agent, Date.now()));
}

/** Scenarios feed events in; detection and pausing happen in enforce(), as for a real agent. */
function runScenario(scenario: V2.SimulationScenario) {
  const pickAgent = (preferred: string) =>
    agents.find((a) => a.id === preferred && a.status !== 'paused') ??
    agents.find((a) => a.status === 'active' || a.status === 'error');

  const preferred: Record<V2.SimulationScenario, string> = {
    repeating: 'agt_codereview', sequence_loop: 'agt_pipeline', failing: 'agt_support', token_heavy: 'agt_research', healthy: 'agt_sales',
  };
  const agent = pickAgent(preferred[scenario]);
  if (!agent) return;
  const limits = limitsFor(agent.id);
  const tools = profileById(agent.id).tools;
  let result: ReturnType<typeof ingest> = { action: 'continue', reason: null };

  if (scenario === 'repeating') {
    for (let i = 0; i < limits.maxRepeatedToolCalls + 5 && result.action === 'continue'; i++) {
      result = ingest({ ...buildEvent(rng, agent, Date.now() + i, 'repeated_call'), tool_name: tools[0], success: false, message: `${tools[0]} failed: HTTP 503` });
    }
  } else if (scenario === 'failing') {
    for (let i = 0; i < limits.maxConsecutiveFailures + 5 && result.action === 'continue'; i++) {
      result = ingest(buildEvent(rng, agent, Date.now() + i, 'api_failure'));
    }
  } else if (scenario === 'token_heavy') {
    const agentTasks = tasks[agent.id] ?? [];
    const task = agentTasks.find((t) => t.status === 'running') ?? agentTasks[0];
    if (task) {
      task.status = 'running';
      if (task.tokens_used > limits.maxTokensPerTask) task.tokens_used = 0;
    }
    const tokens = Math.max(0, limits.maxTokensPerTask - (task?.tokens_used ?? 0)) + 60_000;
    ingest({
      ...buildEvent(rng, agent, Date.now(), 'token_usage'),
      task_id: task?.id ?? null, tokens, cost_usd: +((tokens / 1000) * profileById(agent.id).usdPer1kTokens).toFixed(4),
      message: `LLM completion · ${tokens.toLocaleString('en-US')} tokens`,
    });
  } else if (scenario === 'sequence_loop') {
    // A → B → A → B … : each call differs from the last, so it's not a "repeat",
    // but the sequence is a loop (Charybdis).
    const [a, b] = [tools[0], tools[1] ?? tools[0]];
    const evts: AgentEvent[] = [];
    for (let i = 0; i < 8; i++) {
      const e = { ...buildEvent(rng, agent, Date.now() + i, 'tool_call'), tool_name: i % 2 ? b : a, success: true, message: `${i % 2 ? b : a} completed` };
      ingest(e);
      evts.push(e);
    }
    openIncident(agent, 'execution_loop', 'critical', `Sequence loop: ${a} → ${b} repeating`,
      `${agent.name} cycled through ${a} → ${b} ${evts.length / 2} times without making progress.`,
      sumCost(evts) + 0.6, evts,
      `Each step succeeds, but the plan never advances: the output of ${b} sends the agent back to ${a}. No single call looks wrong, which is why this kind of loop is easy to miss.`,
      ['Add a step counter or progress check to the planning loop.', `Detect when ${a} → ${b} repeats with the same inputs and break out.`, 'Resume the agent after adding a max-iterations guard.'],
      { sequence: [a, b], cycles: evts.length / 2, repeated_calls: evts.length });
    pause(agent, `sequence loop ${a} → ${b}`);
  } else {
    for (let i = 0; i < 3; i++) ingest({ ...buildEvent(rng, agent, Date.now() + i, 'tool_call'), success: true });
  }
}

if (typeof window !== 'undefined') {
  window.setInterval(tick, TICK_MS);
}

/* ---------------- API implementation (contract v2) ---------------- */

export const mockApi: TokenShieldApi = {
  getOverview: () =>
    respond((): V2.MetricsOverview => ({
      active_agents: agents.filter((a) => a.status === 'active' || a.status === 'error').length,
      total_tokens: agents.reduce((s, a) => s + a.total_tokens, 0),
      estimated_cost: +agents.reduce((s, a) => s + a.total_cost_usd, 0).toFixed(4),
      potential_waste: +incidents.reduce((s, i) => s + i.estimated_waste_usd, 0).toFixed(4),
      detected_loops: incidents.filter((i) => i.type === 'execution_loop' || i.type === 'repeated_tool_calls').length,
      active_incidents: incidents.filter((i) => i.status !== 'resolved').length,
      cost_is_estimate: true,
    })),

  getTimeseries: (minutes) =>
    respond((): V2.TimeseriesResponse => {
      const since = Date.now() - minutes * 60_000;
      const buckets = new Map<number, V2.TimeseriesPoint>();
      for (const e of events) {
        const t = Date.parse(e.timestamp);
        if (t < since) break; // events are newest first
        const minute = Math.floor(t / 60_000) * 60_000;
        // Like the real API: no 'Z' suffix on aggregate timestamps (still UTC).
        const point = buckets.get(minute) ?? { time: new Date(minute).toISOString().slice(0, 19), calls: 0, tokens: 0, cost: 0, failures: 0 };
        if (isToolEvent(e)) point.calls += 1;
        if (e.success === false) point.failures += 1;
        point.tokens += e.tokens ?? 0;
        point.cost = +(point.cost + (e.cost_usd ?? 0)).toFixed(6);
        buckets.set(minute, point);
      }
      const series = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
      return { series, is_estimate: true, source: 'mock_in_browser' };
    }),

  getAgents: () => respond(() => agents.map(toAgentV2)),

  getAgent: (id) => respond(() => toAgentV2(findAgent(id))),

  getAgentEvents: (id, limit = 100) =>
    respond(() => {
      findAgent(id);
      return events.filter((e) => e.agent_id === id).slice(0, limit).map(toEventV2);
    }),

  resumeAgent: (id) =>
    respond((): V2.ResumeAgentResponse => {
      const agent = findAgent(id);
      resume(agent);
      return { agent_id: agent.id, status: 'active' };
    }),

  getRecentEvents: (limit = 50) => respond(() => events.slice(0, limit).map(toEventV2), 60),

  getIncidents: (status) =>
    respond(() => incidents.filter((i) => !status || i.status === status).map(toIncidentV2)),

  getIncident: (id) => respond(() => toIncidentV2(findIncident(id))),

  updateIncident: (id, body) =>
    respond(() => {
      const incident = findIncident(id);
      incident.status = body.status;
      incident.resolved_at = body.status === 'resolved' ? nowIso() : null;
      return toIncidentV2(incident);
    }),

  analyzeIncident: (id) =>
    respond(() => {
      const incident = findIncident(id);
      incident.gemini_explanation ??=
        'The agent kept repeating work that could not succeed in its current state. The pattern matches a missing guard in its retry or planning loop rather than a one-off failure.';
      if (incident.recommended_actions.length === 0) incident.recommended_actions = ['Add a retry limit to the failing step.'];
      analysisReadyAt[incident.id] = 0;
      return toIncidentV2(incident);
    }, 2_500),

  startSimulation: () =>
    respond((): V2.StartSimulationResponse => {
      simulationRunning = true;
      return { started: ['healthy', 'repeating', 'token_heavy', 'failing', 'sequence_loop'], simulated: true };
    }),

  stopSimulation: () =>
    respond((): V2.StopSimulationResponse => {
      simulationRunning = false;
      return { stopped: true };
    }),

  triggerSimulation: (scenario) =>
    respond((): V2.TriggerSimulationResponse => {
      runScenario(scenario);
      return { started: scenario, simulated: true };
    }),

  getHealth: () => respond(() => ({ status: 'ok', environment: 'mock' })),

  getAgentGuards: (id) => respond(() => { findAgent(id); return toGuards(id); }),

  updateAgentGuards: (id, body) =>
    respond(() => {
      findAgent(id);
      guardsById[id] = { ...body };
      return toGuards(id);
    }),

  askOracle: (question, agentId) => respond(() => mockOracle(question, agentId), 900),

  getNotificationStatus: () => respond((): V2.NotificationStatus => ({ discord: false, slack: false, email: false, gemini: false })),
};

/* ---------------- demo-mode Oracle (rule-based, plain words) ---------------- */

const usd = (v: number) => (v >= 0.01 ? `about $${v.toFixed(2)}` : 'less than a cent');
const nice = (name: string) => name.replace(/^\[SIM\]\s*/, '');

function mockOracle(question: string, agentId?: string): V2.OracleAnswer {
  const q = question.toLowerCase();
  const pool = agentId ? agents.filter((a) => a.id === agentId) : agents;
  const ranked = [...pool].sort((a, b) => b.total_cost_usd - a.total_cost_usd);
  const total = pool.reduce((s, a) => s + a.total_cost_usd, 0);
  const open = incidents.filter((i) => i.status !== 'resolved' && (!agentId || i.agent_id === agentId));
  const latest = open[0];
  const base = { source: 'rules' as const };

  if (/(cost|spend|money|expensive|price|bill|\$)/.test(q)) {
    const top = ranked[0];
    return {
      ...base,
      answer: `${nice(top.name)} has cost the most so far: ${usd(top.total_cost_usd)} out of ${usd(total)} in total. These numbers are estimates, not your real bill.`,
      key_points: ranked.slice(0, 3).map((a) => `${nice(a.name)}: ${usd(a.total_cost_usd)}`),
      next_step: `Open ${nice(top.name)} and set a budget so it pauses before it spends too much.`,
    };
  }
  if (/(save|saved|saving|protect)/.test(q)) {
    const waste = incidents.reduce((s, i) => s + i.estimated_waste_usd, 0);
    return {
      ...base,
      answer: `TokenShield caught ${incidents.length} problems and paused the agents involved. Those problems had already wasted ${usd(waste)}; without the pause, the loops would have kept going and cost several times more.`,
      key_points: ['Loops are stopped automatically', 'Each stop is explained in plain words', 'You decide when to resume'],
      next_step: 'See the "Saved by TokenShield" card on The watch.',
    };
  }
  if (/(paus|stop|why)/.test(q) && latest) {
    const p = plainFor(INCIDENT_TYPE_V2[latest.type]);
    return {
      ...base,
      answer: `${nice(latest.agent_name)} was paused because ${p.what.charAt(0).toLowerCase()}${p.what.slice(1)} ${p.analogy}`,
      key_points: [latest.description, `Wasted ${usd(latest.estimated_waste_usd)} before it was stopped`],
      next_step: p.fix,
    };
  }
  if (open.length > 0) {
    const p = plainFor(INCIDENT_TYPE_V2[latest.type]);
    return {
      ...base,
      answer: `${open.length} problem${open.length > 1 ? 's' : ''} still need attention. The latest is on ${nice(latest.agent_name)}: ${p.what} ${p.analogy}`,
      key_points: open.slice(0, 3).map((i) => `${nice(i.agent_name)}: ${i.title}`),
      next_step: p.fix,
    };
  }
  return {
    ...base,
    answer: `All calm. ${pool.length} hero${pool.length === 1 ? ' is' : 'es are'} at sea, there are no open problems, and total estimated spend is ${usd(total)}.`,
    key_points: [],
    next_step: '',
  };
}

/** Mock-only: lets the UI show the simulator's initial state without an API call. */
export const isMockSimulationRunning = () => simulationRunning;
