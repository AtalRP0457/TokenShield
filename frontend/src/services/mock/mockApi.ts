/**
 * In-browser mock backend. Implements the same TokenShieldApi interface as the
 * real client, keeps state in memory, and runs a small simulator that emits
 * live events — so every page works with no backend running.
 *
 * Nothing here persists: reload the page to reset.
 */
import type { TokenShieldApi } from '../apiClient';
import { ApiError } from '../http';
import type {
  Agent,
  AgentDetail,
  AgentEvent,
  AgentTask,
  CostMetricPoint,
  Incident,
  IncidentType,
  Severity,
  SimulationScenario,
  TokenMetricPoint,
} from '../../types/api';
import {
  buildEvent,
  createRng,
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

/** Apply an event to every aggregate, exactly like a backend would. */
function recordEvent(event: AgentEvent) {
  events.unshift(event);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;

  const agent = agents.find((a) => a.id === event.agent_id);
  if (agent) {
    agent.last_seen_at = event.timestamp;
    agent.total_tokens += event.tokens ?? 0;
    agent.total_cost_usd = +(agent.total_cost_usd + (event.cost_usd ?? 0)).toFixed(4);
    if (event.type === 'tool_call' || event.type === 'api_failure' || event.type === 'repeated_call') {
      agent.tool_calls += 1;
      if (event.success === false) agent.failed_tool_calls += 1;
    }
    const task = tasks[agent.id]?.find((t) => t.id === event.task_id);
    if (task && task.status === 'running') {
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
}

function openIncident(agent: Agent, type: IncidentType, severity: Severity, title: string, description: string, waste: number, related: AgentEvent[], explanation: string, actions: string[]) {
  const incident: Incident = {
    id: `inc_${incidentSeq++}`,
    agent_id: agent.id,
    agent_name: agent.name,
    type,
    severity,
    status: 'open',
    title,
    description,
    estimated_waste_usd: waste,
    detected_at: new Date().toISOString(),
    resolved_at: null,
    gemini_explanation: explanation,
    recommended_actions: actions,
    related_event_ids: related.map((e) => e.id),
  };
  incidents.unshift(incident);
  agent.incident_count += 1;
  const bucket = currentBucket<CostMetricPoint>(costSeries, (timestamp) => ({ timestamp, cost_usd: 0, wasted_cost_usd: 0 }));
  bucket.wasted_cost_usd = +(bucket.wasted_cost_usd + waste).toFixed(2);
  return incident;
}

/* ---------------- simulator ---------------- */

function tick() {
  if (!simulationRunning) return;
  const live = agents.filter((a) => a.status === 'active' || a.status === 'error');
  if (live.length === 0) return;
  recordEvent(buildEvent(rng, rng.pick(live), Date.now()));
}

function runScenario(scenario: SimulationScenario): string {
  const pickAgent = (preferred: string) =>
    agents.find((a) => a.id === preferred && a.status !== 'paused') ??
    agents.find((a) => a.status === 'active') ??
    agents[0];

  const burst = (agent: Agent, type: AgentEvent['type'], n: number, patch: Partial<AgentEvent>) => {
    const produced: AgentEvent[] = [];
    for (let i = 0; i < n; i++) {
      const e = { ...buildEvent(rng, agent, Date.now() + i, type), ...patch };
      recordEvent(e);
      produced.push(e);
    }
    return produced;
  };

  if (scenario === 'execution_loop') {
    const agent = pickAgent('agt_codereview');
    const tool = profileById(agent.id).tools[0];
    const evts = burst(agent, 'repeated_call', 6, { tool_name: tool, message: `${tool} called again with identical arguments` });
    const waste = +evts.reduce((s, e) => s + (e.cost_usd ?? 0), 4.2).toFixed(2);
    agent.status = 'error';
    openIncident(agent, 'execution_loop', 'critical', `Execution loop detected on ${tool}`,
      `${agent.name} invoked ${tool} repeatedly with identical arguments and no change in plan.`, waste, evts,
      `The agent is retrying ${tool} after each identical result instead of revising its plan. Because every iteration re-sends the full conversation history, token usage grows with each loop.`,
      ['Pause the agent and stop the current task.', `Cap ${tool} at 3 identical calls per task.`, 'Add a max-iterations guard to the planning loop.']);
    return `Execution loop injected into ${agent.name}`;
  }

  if (scenario === 'failure_storm') {
    const agent = pickAgent('agt_support');
    const evts = burst(agent, 'api_failure', 5, {});
    openIncident(agent, 'consecutive_failures', 'high', '5 consecutive upstream API failures',
      `${agent.name} received 5 failed responses in a row from upstream APIs.`, 0.84, evts,
      'The upstream dependency is returning errors and the agent retries immediately without backoff, consuming tokens on planning steps that cannot succeed.',
      ['Add exponential backoff with jitter.', 'Open a circuit breaker after 5 consecutive failures.']);
    return `Failure storm injected into ${agent.name}`;
  }

  const agent = pickAgent('agt_research');
  const evts = burst(agent, 'token_usage', 3, { tokens: 180_000, cost_usd: 0.81, message: 'LLM completion · 180,000 tokens' });
  openIncident(agent, 'token_limit_exceeded', 'high', 'Token spike: 540k tokens in under a minute',
    `${agent.name} sent three near-maximum-context completions back to back.`, 2.43, evts,
    'Large documents were placed directly into the prompt instead of being chunked and retrieved, so each completion used almost the full context window.',
    ['Chunk documents and retrieve only relevant passages.', 'Set a per-task limit of 200k tokens.']);
  return `Token spike injected into ${agent.name}`;
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
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        total_tokens: 0,
        total_cost_usd: 0,
        tool_calls: 0,
        failed_tool_calls: 0,
        incident_count: 0,
      };
      agents.push(agent);
      return agent;
    }),

  ingestEvent: (body) =>
    respond(() => {
      const agent = findAgent(body.agent_id);
      const event: AgentEvent = { ...body, id: `evt_ext_${Date.now()}`, agent_name: agent.name };
      recordEvent(event);
      return event;
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
      incident.resolved_at = body.status === 'resolved' ? new Date().toISOString() : null;
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
