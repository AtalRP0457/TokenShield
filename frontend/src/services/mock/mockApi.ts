/**
 * In-browser mock backend. Implements the same TokenShieldApi interface as the
 * real client, keeps state in memory, and runs a small simulator that emits
 * live events — so every page works with no backend running.
 *
 * It also behaves like the real backend should: every event is checked against
 * the protection limits (Athena's wards), and an agent that breaks one gets an
 * incident AND is stopped. Treat `enforce()` below as reference logic for the
 * FastAPI implementation.
 *
 * Nothing here persists: reload the page to reset.
 */
import type { TokenShieldApi } from '../apiClient';
import { ApiError } from '../http';
import { loadSettings } from '../settingsStorage';
import type {
  Agent,
  AgentAction,
  AgentDetail,
  AgentEvent,
  AgentTask,
  CostMetricPoint,
  Incident,
  IncidentType,
  PausedBy,
  Severity,
  SimulationScenario,
  TokenMetricPoint,
} from '../../types/api';
import {
  buildEvent,
  createRng,
  nextEventId,
  profileById,
  seedAgents,
  seedEvents,
  seedIncidents,
  seedSeries,
  seedTasks,
} from './mockData';

const HOUR = 3_600_000;
const MAX_EVENTS = 3_000;
const TICK_MS = 2_200;

/* ---------------- state ---------------- */

const rng = createRng(20261114);
const agents: Agent[] = seedAgents();
const tasks: Record<string, AgentTask[]> = seedTasks(rng);
const events: AgentEvent[] = seedEvents(rng, agents); // newest first
const incidents: Incident[] = seedIncidents(events);
const { tokens: tokenSeries, cost: costSeries } = seedSeries(rng);
let simulationRunning = true;
let incidentSeq = 1043;

/** Per-agent streak counters used by enforce(). */
const streaks: Record<string, { failures: AgentEvent[]; repeats: AgentEvent[] }> = {};
const streakFor = (id: string) => (streaks[id] ??= { failures: [], repeats: [] });

/* ---------------- live event bus ---------------- */

type Listener = (event: AgentEvent) => void;
const listeners = new Set<Listener>();

/** Used by services/liveFeed.ts in mock mode, in place of a WebSocket. */
export function subscribeMockEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ---------------- helpers ---------------- */

const clone = <T,>(value: T): T => structuredClone(value);
const delay = (ms = 120 + Math.random() * 280) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const sumCost = (evts: AgentEvent[]) => evts.reduce((s, e) => s + (e.cost_usd ?? 0), 0);

async function respond<T>(produce: () => T): Promise<T> {
  await delay();
  return clone(produce());
}

function findAgent(id: string): Agent {
  const agent = agents.find((a) => a.id === id);
  if (!agent) throw new ApiError(`404 Agent ${id} not found`, `/api/agents/${id}`, 404);
  return agent;
}

function currentBucket<T extends { timestamp: string }>(series: T[], make: (ts: string) => T): T {
  const hour = Math.floor(Date.now() / HOUR) * HOUR;
  const last = series[series.length - 1];
  if (last && Date.parse(last.timestamp) === hour) return last;
  const fresh = make(new Date(hour).toISOString());
  series.push(fresh);
  if (series.length > 24) series.shift();
  return fresh;
}

/* ---------------- aggregates ---------------- */

/** Apply an event to every aggregate, exactly like a backend would. */
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
    if (event.type === 'tool_call' || event.type === 'api_failure' || event.type === 'repeated_call') {
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

  if (event.tokens) {
    const bucket = currentBucket<TokenMetricPoint>(tokenSeries, (timestamp) => ({ timestamp, input_tokens: 0, output_tokens: 0 }));
    const out = Math.round(event.tokens * 0.3);
    bucket.input_tokens += event.tokens - out;
    bucket.output_tokens += out;
  }
  if (event.cost_usd) {
    const bucket = currentBucket<CostMetricPoint>(costSeries, (timestamp) => ({ timestamp, cost_usd: 0, wasted_cost_usd: 0 }));
    bucket.cost_usd = +(bucket.cost_usd + event.cost_usd).toFixed(4);
    if (event.type === 'repeated_call' || event.success === false) {
      bucket.wasted_cost_usd = +(bucket.wasted_cost_usd + event.cost_usd).toFixed(4);
    }
  }

  listeners.forEach((l) => l(clone(event)));
  return { tokensBefore, task };
}

function openIncident(agent: Agent, type: IncidentType, severity: Severity, title: string, description: string, waste: number, related: AgentEvent[], explanation: string, actions: string[], stopped: boolean) {
  const incident: Incident = {
    id: `inc_${incidentSeq++}`,
    agent_id: agent.id,
    agent_name: agent.name,
    type,
    severity,
    status: 'open',
    title,
    description,
    estimated_waste_usd: +waste.toFixed(2),
    detected_at: nowIso(),
    resolved_at: null,
    gemini_explanation: explanation,
    recommended_actions: actions,
    related_event_ids: related.map((e) => e.id),
    agent_stopped: stopped,
  };
  incidents.unshift(incident);
  agent.incident_count += 1;
  const bucket = currentBucket<CostMetricPoint>(costSeries, (timestamp) => ({ timestamp, cost_usd: 0, wasted_cost_usd: 0 }));
  bucket.wasted_cost_usd = +(bucket.wasted_cost_usd + waste).toFixed(2);
  return incident;
}

/* ---------------- pause / resume ---------------- */

function pause(agent: Agent, by: PausedBy, reason: string) {
  if (agent.status === 'paused') return;
  agent.status = 'paused';
  agent.paused_by = by;
  agent.pause_reason = reason;
  tasks[agent.id]?.forEach((t) => t.status === 'running' && (t.status = 'stopped'));
  delete streaks[agent.id];
  applyEvent({
    id: nextEventId(), agent_id: agent.id, agent_name: agent.name, type: 'agent_stopped', timestamp: nowIso(),
    message: by === 'tokenshield' ? `TokenShield stopped this agent: ${reason}` : `Paused from the dashboard: ${reason}`,
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

/* ---------------- enforcement (the "backend" brain) ---------------- */

/**
 * Record an event, then check it against the protection limits.
 * Returns what TokenShield tells the agent to do next.
 */
function ingest(event: AgentEvent): { action: AgentAction; reason: string | null } {
  const agent = agents.find((a) => a.id === event.agent_id);
  if (agent?.status === 'paused') {
    // A stopped agent that keeps reporting is told to stop again.
    return { action: 'stop', reason: agent.pause_reason };
  }
  const { tokensBefore, task } = applyEvent(event);
  if (!agent) return { action: 'continue', reason: null };
  return enforce(agent, event, tokensBefore, task);
}

function enforce(agent: Agent, event: AgentEvent, tokensBefore: number, task?: AgentTask): { action: AgentAction; reason: string | null } {
  const limits = loadSettings();
  const s = streakFor(agent.id);
  const isCall = event.type === 'tool_call' || event.type === 'api_failure' || event.type === 'repeated_call';

  if (isCall) {
    if (event.success === false) s.failures.push(event);
    else s.failures = [];
    if (event.type === 'repeated_call') s.repeats.push(event);
    else s.repeats = [];
  }

  // Charybdis: the same call repeated too many times.
  if (s.repeats.length >= limits.maxRepeatedToolCalls) {
    const tool = event.tool_name ?? 'a tool';
    const evts = [...s.repeats];
    const reason = `${tool} repeated ${evts.length}× with identical arguments (limit ${limits.maxRepeatedToolCalls})`;
    openIncident(agent, 'execution_loop', 'critical', `Execution loop on ${tool}: agent stopped`,
      `${agent.name} kept calling ${tool} with identical arguments. TokenShield stopped it at the configured limit.`,
      sumCost(evts) + 2.5, evts,
      `The agent retries ${tool} after each identical result instead of revising its plan. Every iteration re-sends the full conversation history, so cost grows with each loop. Stopping it now prevents the loop from running until the context window fills.`,
      ['Review the task that was running and fix the step that keeps failing.', `Keep ${tool} capped at ${limits.maxRepeatedToolCalls} identical calls per task.`, 'Resume the agent once the cause is fixed.'],
      true);
    pause(agent, 'tokenshield', reason);
    return { action: 'stop', reason };
  }

  // Poseidon's storm: too many failures in a row.
  if (s.failures.length >= limits.maxConsecutiveFailures) {
    const evts = [...s.failures];
    const reason = `${evts.length} consecutive failures (limit ${limits.maxConsecutiveFailures})`;
    openIncident(agent, 'consecutive_failures', 'high', `${evts.length} failures in a row: agent stopped`,
      `${agent.name} failed ${evts.length} tool or API calls in a row. TokenShield stopped it before it kept retrying.`,
      sumCost(evts) + 0.6, evts,
      'An upstream dependency is failing and the agent retries immediately without backing off, spending tokens on planning steps that cannot succeed.',
      ['Check the upstream service the agent depends on.', 'Add exponential backoff with jitter to the failing tool.', 'Resume the agent once the service is healthy.'],
      true);
    pause(agent, 'tokenshield', reason);
    return { action: 'stop', reason };
  }

  // Aeolus' winds: this event pushed a task over its token budget.
  if (task && task.status === 'running' && tokensBefore <= limits.maxTokensPerTask && task.tokens_used > limits.maxTokensPerTask) {
    const reason = `task “${task.name}” used ${task.tokens_used.toLocaleString('en-US')} tokens (limit ${limits.maxTokensPerTask.toLocaleString('en-US')})`;
    openIncident(agent, 'token_limit_exceeded', 'high', `Token budget exceeded on “${task.name}”: agent stopped`,
      `${agent.name} went past the per-task token budget. TokenShield stopped it before it could spend more.`,
      (event.cost_usd ?? 0) * 0.8 + 1.2, [event],
      'Large documents were placed directly into the prompt instead of being chunked and retrieved, so each completion used almost the full context window.',
      ['Chunk documents and retrieve only the relevant passages.', 'Keep the per-task token budget in Athena’s wards.', 'Resume the agent after reducing prompt size.'],
      true);
    pause(agent, 'tokenshield', reason);
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

  // Healthy agents finish their tasks before hitting the budget: recycle any
  // running task past 60% of the limit (task_completed → fresh task_started),
  // so background traffic never trips the token rule on its own.
  const limit = loadSettings().maxTokensPerTask;
  for (const task of tasks[agent.id] ?? []) {
    if (task.status !== 'running' || task.tokens_used <= limit * 0.6) continue;
    ingest({ id: nextEventId(), agent_id: agent.id, agent_name: agent.name, type: 'task_completed', task_id: task.id, success: true, timestamp: nowIso(), message: `Completed task “${task.name}”` });
    Object.assign(task, { status: 'running', tokens_used: 0, cost_usd: 0, tool_calls: 0, started_at: nowIso() });
    ingest({ id: nextEventId(), agent_id: agent.id, agent_name: agent.name, type: 'task_started', task_id: task.id, timestamp: nowIso(), message: `Started task “${task.name}”` });
  }

  ingest(buildEvent(rng, agent, Date.now()));
}

const perilName: Record<SimulationScenario, string> = {
  execution_loop: 'Charybdis',
  failure_storm: "Poseidon's storm",
  token_spike: "Aeolus' winds",
};

/**
 * Scenarios only feed events in. Detection and stopping are done by enforce(),
 * exactly as they would be for a real agent.
 */
function runScenario(scenario: SimulationScenario): string {
  const pickAgent = (preferred: string) =>
    agents.find((a) => a.id === preferred && a.status !== 'paused') ??
    agents.find((a) => a.status === 'active' || a.status === 'error');

  const agent = pickAgent(
    scenario === 'execution_loop' ? 'agt_codereview' : scenario === 'failure_storm' ? 'agt_support' : 'agt_research',
  );
  if (!agent) return 'No running agent to target. Resume an agent first.';

  const limits = loadSettings();
  const tool = profileById(agent.id).tools[0];
  let result: ReturnType<typeof ingest> = { action: 'continue', reason: null };

  if (scenario === 'execution_loop') {
    for (let i = 0; i < limits.maxRepeatedToolCalls + 5 && result.action === 'continue'; i++) {
      result = ingest({ ...buildEvent(rng, agent, Date.now() + i, 'repeated_call'), tool_name: tool, message: `${tool} called again with identical arguments` });
    }
  } else if (scenario === 'failure_storm') {
    for (let i = 0; i < limits.maxConsecutiveFailures + 5 && result.action === 'continue'; i++) {
      result = ingest(buildEvent(rng, agent, Date.now() + i, 'api_failure'));
    }
  } else {
    const agentTasks = tasks[agent.id] ?? [];
    const task = agentTasks.find((t) => t.status === 'running') ?? agentTasks[0];
    if (task) task.status = 'running';
    const tokens = Math.max(0, limits.maxTokensPerTask - (task?.tokens_used ?? 0)) + 60_000;
    const cost = +((tokens / 1000) * profileById(agent.id).usdPer1kTokens).toFixed(4);
    result = ingest({
      ...buildEvent(rng, agent, Date.now(), 'token_usage'),
      task_id: task?.id ?? null, tokens, cost_usd: cost,
      message: `LLM completion · ${tokens.toLocaleString('en-US')} tokens`,
    });
  }

  return result.action === 'stop'
    ? `${perilName[scenario]} caught on ${agent.name}. TokenShield stopped the agent.`
    : `${perilName[scenario]} sent to ${agent.name}, but no limit was reached. Check Athena's wards.`;
}

if (typeof window !== 'undefined') {
  window.setInterval(tick, TICK_MS);
}

/* ---------------- API implementation ---------------- */

export const mockApi: TokenShieldApi = {
  registerAgent: (body) =>
    respond(() => {
      const agent: Agent = {
        id: `agt_${Math.random().toString(36).slice(2, 8)}`,
        name: body.name,
        description: body.description ?? '',
        model: body.model,
        status: 'idle',
        created_at: nowIso(),
        last_seen_at: nowIso(),
        total_tokens: 0,
        total_cost_usd: 0,
        tool_calls: 0,
        failed_tool_calls: 0,
        incident_count: 0,
        paused_by: null,
        pause_reason: null,
      };
      agents.push(agent);
      return agent;
    }),

  ingestEvent: (body) =>
    respond(() => {
      const agent = findAgent(body.agent_id);
      const event: AgentEvent = { ...body, id: nextEventId(), agent_name: agent.name };
      const { action, reason } = ingest(event);
      return { event, action, reason };
    }),

  getAgents: () => respond(() => agents),

  getAgent: (id) =>
    respond((): AgentDetail => {
      const agent = findAgent(id);
      return { ...agent, current_tasks: tasks[id] ?? [] };
    }),

  getAgentEvents: (id) =>
    respond(() => {
      findAgent(id);
      return events.filter((e) => e.agent_id === id).slice(0, 200);
    }),

  pauseAgent: (id, body) =>
    respond(() => {
      const agent = findAgent(id);
      pause(agent, 'user', body.reason?.trim() || 'Paused from the dashboard');
      return agent;
    }),

  resumeAgent: (id) =>
    respond(() => {
      const agent = findAgent(id);
      resume(agent);
      return agent;
    }),

  getOverview: () =>
    respond(() => {
      const sum = (fn: (a: Agent) => number) => agents.reduce((s, a) => s + fn(a), 0);
      return {
        active_agents: agents.filter((a) => a.status === 'active' || a.status === 'error').length,
        total_agents: agents.length,
        total_tokens: sum((a) => a.total_tokens),
        total_cost_usd: +sum((a) => a.total_cost_usd).toFixed(2),
        wasted_cost_usd: +incidents.reduce((s, i) => s + i.estimated_waste_usd, 0).toFixed(2),
        loops_detected: incidents.filter((i) => i.type === 'execution_loop').length,
        active_incidents: incidents.filter((i) => i.status !== 'resolved').length,
        successful_tool_calls: sum((a) => a.tool_calls - a.failed_tool_calls),
        failed_tool_calls: sum((a) => a.failed_tool_calls),
      };
    }),

  getTokenMetrics: () => respond(() => tokenSeries),
  getCostMetrics: () => respond(() => costSeries),

  getAgentMetrics: () =>
    respond(() =>
      agents.map((a) => ({
        agent_id: a.id,
        agent_name: a.name,
        total_tokens: a.total_tokens,
        total_cost_usd: a.total_cost_usd,
        successful_tool_calls: a.tool_calls - a.failed_tool_calls,
        failed_tool_calls: a.failed_tool_calls,
      })),
    ),

  getIncidents: () => respond(() => incidents),

  getIncident: (id) =>
    respond(() => {
      const incident = incidents.find((i) => i.id === id);
      if (!incident) throw new ApiError(`404 Incident ${id} not found`, `/api/incidents/${id}`, 404);
      return incident;
    }),

  updateIncident: (id, body) =>
    respond(() => {
      const incident = incidents.find((i) => i.id === id);
      if (!incident) throw new ApiError(`404 Incident ${id} not found`, `/api/incidents/${id}`, 404);
      incident.status = body.status;
      incident.resolved_at = body.status === 'resolved' ? nowIso() : null;
      return incident;
    }),

  startSimulation: () =>
    respond(() => {
      simulationRunning = true;
      return { running: true, message: 'Simulation started' };
    }),

  stopSimulation: () =>
    respond(() => {
      simulationRunning = false;
      return { running: false, message: 'Simulation stopped' };
    }),

  triggerSimulation: ({ scenario }) =>
    respond(() => ({ running: simulationRunning, message: runScenario(scenario) })),

  getHealth: () => respond(() => ({ status: 'ok' as const, version: 'mock' })),
};

/** Mock-only: lets the UI show the simulator's initial state without an API call. */
export const isMockSimulationRunning = () => simulationRunning;
