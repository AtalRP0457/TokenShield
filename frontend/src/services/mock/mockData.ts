/**
 * Seed data for mock mode. Generated deterministically (seeded RNG) so the
 * dashboard looks the same on every reload, which makes demos predictable.
 *
 * Only used by mockApi.ts — the rest of the app never imports this file.
 */
import type {
  Agent,
  AgentEvent,
  AgentTask,
  CostMetricPoint,
  Incident,
  TokenMetricPoint,
} from '../../types/api';

/* ---------------- deterministic RNG ---------------- */

export function createRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof createRng>;

/* ---------------- agent profiles ---------------- */

/** Extra per-agent knobs the generator uses; not part of the API contract. */
export interface AgentProfile {
  id: string;
  tools: string[];
  usdPer1kTokens: number;
  failureRate: number;
  tasks: string[];
}

const HOUR = 3_600_000;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

export const AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'agt_research',
    tools: ['web_search', 'fetch_url', 'vector_search', 'summarize_document'],
    usdPer1kTokens: 0.0045,
    failureRate: 0.06,
    tasks: ['Competitive landscape: vector DBs', 'Summarize Q3 earnings calls', 'Literature review: RAG eval'],
  },
  {
    id: 'agt_support',
    tools: ['lookup_order', 'search_knowledge_base', 'create_ticket', 'send_email'],
    usdPer1kTokens: 0.0008,
    failureRate: 0.04,
    tasks: ['Ticket #48213 refund request', 'Ticket #48219 shipping delay', 'Ticket #48224 account access'],
  },
  {
    id: 'agt_codereview',
    tools: ['git_diff', 'read_file', 'run_tests', 'post_review_comment'],
    usdPer1kTokens: 0.009,
    failureRate: 0.32,
    tasks: ['Review PR #1287 payments-service', 'Review PR #1291 auth refactor'],
  },
  {
    id: 'agt_pipeline',
    tools: ['query_warehouse', 'transform_rows', 'validate_schema', 'write_parquet'],
    usdPer1kTokens: 0.0006,
    failureRate: 0.08,
    tasks: ['Nightly orders ETL', 'Backfill events_2026_10'],
  },
  {
    id: 'agt_sales',
    tools: ['crm_lookup', 'enrich_contact', 'draft_email'],
    usdPer1kTokens: 0.006,
    failureRate: 0.05,
    tasks: ['Outbound sequence: fintech leads'],
  },
  {
    id: 'agt_scraper',
    tools: ['fetch_url', 'parse_html', 'store_record'],
    usdPer1kTokens: 0.0006,
    failureRate: 0.18,
    tasks: ['Crawl supplier catalog'],
  },
];

export const profileById = (id: string) => AGENT_PROFILES.find((p) => p.id === id)!;

export function seedAgents(): Agent[] {
  const base: Omit<Agent, 'last_seen_at' | 'paused_by' | 'pause_reason'>[] = [
    {
      id: 'agt_research', name: 'Research Assistant', model: 'gemini-2.5-pro', status: 'active',
      description: 'Multi-step web research and report synthesis for the strategy team.',
      created_at: iso(now - 21 * 24 * HOUR), total_tokens: 18_420_310, total_cost_usd: 82.89,
      tool_calls: 4_812, failed_tool_calls: 211, incident_count: 2,
    },
    {
      id: 'agt_support', name: 'Customer Support Bot', model: 'gpt-4.1-mini', status: 'active',
      description: 'Tier-1 support: order lookups, refunds and ticket triage.',
      created_at: iso(now - 45 * 24 * HOUR), total_tokens: 31_052_880, total_cost_usd: 24.84,
      tool_calls: 12_390, failed_tool_calls: 402, incident_count: 1,
    },
    {
      id: 'agt_codereview', name: 'Code Review Agent', model: 'claude-sonnet-4', status: 'error',
      description: 'Reviews pull requests, runs tests and posts inline comments.',
      created_at: iso(now - 9 * 24 * HOUR), total_tokens: 9_874_120, total_cost_usd: 88.87,
      tool_calls: 3_120, failed_tool_calls: 948, incident_count: 4,
    },
    {
      id: 'agt_pipeline', name: 'Data Pipeline Agent', model: 'gemini-2.5-flash', status: 'active',
      description: 'Orchestrates nightly ETL jobs and validates warehouse schemas.',
      created_at: iso(now - 30 * 24 * HOUR), total_tokens: 14_330_400, total_cost_usd: 8.6,
      tool_calls: 6_740, failed_tool_calls: 377, incident_count: 1,
    },
    {
      id: 'agt_sales', name: 'Sales Outreach Agent', model: 'gpt-4.1', status: 'idle',
      description: 'Enriches CRM leads and drafts personalised outbound emails.',
      created_at: iso(now - 14 * 24 * HOUR), total_tokens: 5_210_660, total_cost_usd: 31.26,
      tool_calls: 1_904, failed_tool_calls: 58, incident_count: 0,
    },
    {
      id: 'agt_scraper', name: 'Web Scraper', model: 'gemini-2.5-flash', status: 'paused',
      description: 'Crawls supplier catalogues and normalises product records.',
      created_at: iso(now - 6 * 24 * HOUR), total_tokens: 3_980_200, total_cost_usd: 2.39,
      tool_calls: 2_655, failed_tool_calls: 512, incident_count: 1,
    },
  ];
  const lastSeenOffset: Record<string, number> = {
    agt_research: 20_000, agt_support: 8_000, agt_codereview: 45_000,
    agt_pipeline: 30_000, agt_sales: 2.5 * HOUR, agt_scraper: 5 * HOUR,
  };
  // Lifetime totals scaled so they're consistent with the hourly series.
  return base.map((a) => ({
    ...a,
    total_tokens: a.total_tokens * 8,
    total_cost_usd: +(a.total_cost_usd * 8).toFixed(2),
    last_seen_at: iso(now - lastSeenOffset[a.id]),
    paused_by: a.status === 'paused' ? ('user' as const) : null,
    pause_reason: a.status === 'paused' ? 'Paused by operator while the supplier site is rate limiting' : null,
  }));
}

export function seedTasks(rng: Rng): Record<string, AgentTask[]> {
  const out: Record<string, AgentTask[]> = {};
  for (const p of AGENT_PROFILES) {
    out[p.id] = p.tasks.map((name, i) => {
      const running = p.id !== 'agt_sales' && p.id !== 'agt_scraper' && i < 2;
      const tokens = rng.int(8_000, 160_000) * (p.id === 'agt_codereview' ? 4 : 1);
      return {
        id: `tsk_${p.id.slice(4)}_${i + 1}`,
        name,
        status: running ? 'running' : p.id === 'agt_scraper' ? 'stopped' : 'completed',
        started_at: iso(now - rng.int(2, 90) * 60_000),
        tokens_used: tokens,
        cost_usd: +((tokens / 1000) * p.usdPer1kTokens).toFixed(4),
        tool_calls: rng.int(4, 60),
      };
    });
  }
  return out;
}

/* ---------------- events ---------------- */

let eventCounter = 0;
export const nextEventId = () => `evt_${(++eventCounter).toString(36).padStart(6, '0')}`;

export function buildEvent(
  rng: Rng,
  agent: Agent,
  timestampMs: number,
  forcedType?: AgentEvent['type'],
): AgentEvent {
  const p = profileById(agent.id);
  const roll = rng.next();
  const type: AgentEvent['type'] =
    forcedType ??
    (roll < 0.55 ? 'tool_call'
      : roll < 0.8 ? 'token_usage'
      : roll < 0.87 ? 'task_started'
      : roll < 0.94 ? 'task_completed'
      : agent.id === 'agt_codereview' ? 'repeated_call' : 'api_failure');

  const task = rng.pick(p.tasks);
  const taskId = `tsk_${agent.id.slice(4)}_${p.tasks.indexOf(task) + 1}`;
  const base = { id: nextEventId(), agent_id: agent.id, agent_name: agent.name, timestamp: iso(timestampMs), task_id: taskId };

  switch (type) {
    case 'tool_call': {
      const tool = rng.pick(p.tools);
      const success = !rng.chance(p.failureRate);
      const tokens = rng.int(300, 4_500);
      return {
        ...base, type, tool_name: tool, success, tokens,
        cost_usd: +((tokens / 1000) * p.usdPer1kTokens).toFixed(5),
        latency_ms: rng.int(80, success ? 2_400 : 30_000),
        message: success ? `${tool} completed` : `${tool} failed: ${rng.pick(['timeout after 30s', 'HTTP 429 rate limited', 'HTTP 502 bad gateway', 'invalid arguments'])}`,
      };
    }
    case 'token_usage': {
      const tokens = rng.int(1_500, 22_000);
      return {
        ...base, type, tokens, success: true,
        cost_usd: +((tokens / 1000) * p.usdPer1kTokens).toFixed(5),
        message: `LLM completion · ${tokens.toLocaleString('en-US')} tokens`,
      };
    }
    case 'api_failure': {
      const tool = rng.pick(p.tools);
      return {
        ...base, type, tool_name: tool, success: false, latency_ms: rng.int(5_000, 30_000),
        message: `Upstream API error on ${tool}: ${rng.pick(['503 Service Unavailable', 'connection reset', '429 Too Many Requests'])}`,
      };
    }
    case 'repeated_call': {
      const tool = rng.pick(p.tools);
      const n = rng.int(4, 12);
      const tokens = rng.int(2_000, 6_000);
      return {
        ...base, type, tool_name: tool, success: false, tokens,
        cost_usd: +((tokens / 1000) * p.usdPer1kTokens).toFixed(5),
        message: `${tool} called ${n}× with identical arguments`,
      };
    }
    case 'task_started':
      return { ...base, type, message: `Started task “${task}”` };
    case 'task_completed': {
      const tokens = rng.int(10_000, 90_000);
      return {
        ...base, type, success: true, tokens,
        cost_usd: +((tokens / 1000) * p.usdPer1kTokens).toFixed(4),
        message: `Completed task “${task}”`,
      };
    }
    case 'agent_stopped':
    case 'agent_resumed':
      return { ...base, type, message: type === 'agent_stopped' ? 'Agent stopped' : 'Agent resumed' };
  }
}

export function seedEvents(rng: Rng, agents: Agent[]): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (const agent of agents) {
    const quiet = agent.status === 'idle' || agent.status === 'paused';
    const count = quiet ? 18 : 60;
    const endMs = Date.parse(agent.last_seen_at);
    for (let i = 0; i < count; i++) {
      const t = endMs - i * rng.int(20_000, quiet ? 900_000 : 240_000);
      events.push(buildEvent(rng, agent, t));
    }
  }
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/* ---------------- time series (last 24h, hourly) ---------------- */

export function seedSeries(rng: Rng): { tokens: TokenMetricPoint[]; cost: CostMetricPoint[] } {
  const tokens: TokenMetricPoint[] = [];
  const cost: CostMetricPoint[] = [];
  const currentHour = Math.floor(now / HOUR) * HOUR;
  for (let i = 23; i >= 0; i--) {
    const t = currentHour - i * HOUR;
    const hourOfDay = new Date(t).getHours();
    // business-hours curve + noise
    const load = 0.35 + 0.65 * Math.max(0, Math.sin(((hourOfDay - 6) / 16) * Math.PI));
    const spike = i === 5 || i === 4 ? 2.4 : i === 14 ? 1.7 : 1; // incidents in the data
    // Sized to match the live simulator's throughput (~4–6M tokens/hour).
    const input = Math.round((3_200_000 + rng.int(0, 900_000)) * load * spike);
    const output = Math.round(input * (0.28 + rng.next() * 0.1));
    const usd = ((input + output) / 1000) * 0.0032;
    tokens.push({ timestamp: iso(t), input_tokens: input, output_tokens: output });
    cost.push({
      timestamp: iso(t),
      cost_usd: +usd.toFixed(2),
      wasted_cost_usd: +(spike > 1 ? usd * 0.55 : usd * (0.02 + rng.next() * 0.05)).toFixed(2),
    });
  }
  return { tokens, cost };
}

/* ---------------- incidents ---------------- */

export function seedIncidents(events: AgentEvent[]): Incident[] {
  const idsFor = (agentId: string, n: number) =>
    events.filter((e) => e.agent_id === agentId).slice(0, n).map((e) => e.id);

  return [
    {
      id: 'inc_1042', agent_id: 'agt_codereview', agent_name: 'Code Review Agent',
      type: 'execution_loop', severity: 'critical', status: 'open',
      title: 'Agent stuck re-running the same failing test suite',
      description: 'run_tests was invoked 47 times in 11 minutes with identical arguments while the suite kept failing on the same assertion.',
      estimated_waste_usd: 18.42, detected_at: iso(now - 14 * 60_000), resolved_at: null,
      gemini_explanation:
        'The agent treats every failing test run as a transient error and retries without changing its plan. The failure is deterministic (an assertion in test_refund_rounding), so each retry produces the same result. Because the planner never receives the test output in a summarised form, it cannot reason about the cause and loops until the context window fills, re-sending ~38k tokens of history on every iteration.',
      recommended_actions: [
        'Pause the agent and terminate task “Review PR #1291 auth refactor”.',
        'Cap run_tests at 3 consecutive identical invocations per task.',
        'Feed a summarised test failure back to the planner instead of the raw log.',
        'Add a max-iterations guard to the review loop.',
      ],
      related_event_ids: idsFor('agt_codereview', 6),
      agent_stopped: false,
    },
    {
      id: 'inc_1041', agent_id: 'agt_codereview', agent_name: 'Code Review Agent',
      type: 'token_limit_exceeded', severity: 'high', status: 'investigating',
      title: 'Single task consumed 1.2M tokens',
      description: 'Task “Review PR #1287 payments-service” exceeded the per-task token budget by 6×.',
      estimated_waste_usd: 9.75, detected_at: iso(now - 52 * 60_000), resolved_at: null,
      gemini_explanation:
        'The agent loaded every file in the diff into context, including two 9k-line generated lockfiles. Each follow-up tool call re-sent the full context, multiplying token use.',
      recommended_actions: [
        'Exclude generated files (lockfiles, snapshots) from read_file.',
        'Set a per-task token budget of 200k tokens.',
        'Use git_diff with context lines limited to 20.',
      ],
      related_event_ids: idsFor('agt_codereview', 4),
      agent_stopped: false,
    },
    {
      id: 'inc_1040', agent_id: 'agt_research', agent_name: 'Research Assistant',
      type: 'repeated_tool_calls', severity: 'medium', status: 'open',
      title: 'web_search repeated with near-identical queries',
      description: '23 web_search calls in one task returned overlapping results; 17 were redundant.',
      estimated_waste_usd: 3.12, detected_at: iso(now - 2.1 * HOUR), resolved_at: null,
      gemini_explanation:
        'The agent rephrases the same query slightly after each unsatisfying result instead of fetching the pages it already found. The search results are not cached between steps.',
      recommended_actions: [
        'Cache web_search results per task by normalised query.',
        'Limit repeated tool calls with similar arguments to 5 per task.',
      ],
      related_event_ids: idsFor('agt_research', 5),
      agent_stopped: false,
    },
    {
      id: 'inc_1039', agent_id: 'agt_scraper', agent_name: 'Web Scraper',
      type: 'consecutive_failures', severity: 'high', status: 'open',
      title: '38 consecutive fetch_url failures (HTTP 429)',
      description: 'The supplier site began rate limiting; the agent kept retrying immediately without backoff.',
      estimated_waste_usd: 1.46, detected_at: iso(now - 4.6 * HOUR), resolved_at: null,
      gemini_explanation:
        'Every request after 09:12 returned HTTP 429. The retry policy has no exponential backoff and no circuit breaker, so the agent spent tokens planning retries that could never succeed.',
      recommended_actions: [
        'Add exponential backoff with jitter to fetch_url.',
        'Open a circuit breaker after 5 consecutive failures.',
        'Respect the Retry-After header.',
      ],
      related_event_ids: idsFor('agt_scraper', 5),
      agent_stopped: false,
    },
    {
      id: 'inc_1038', agent_id: 'agt_support', agent_name: 'Customer Support Bot',
      type: 'task_timeout', severity: 'low', status: 'resolved',
      title: 'Ticket triage exceeded 15-minute duration limit',
      description: 'A ticket with a 40-message thread caused slow summarisation.',
      estimated_waste_usd: 0.38, detected_at: iso(now - 7 * HOUR), resolved_at: iso(now - 6.2 * HOUR),
      gemini_explanation:
        'Long email threads were summarised message-by-message. Batching the thread into one summarisation call resolves the slowdown.',
      recommended_actions: ['Summarise long threads in a single batched call.'],
      related_event_ids: idsFor('agt_support', 3),
      agent_stopped: false,
    },
    {
      id: 'inc_1037', agent_id: 'agt_codereview', agent_name: 'Code Review Agent',
      type: 'cost_limit_exceeded', severity: 'high', status: 'resolved',
      title: 'Daily cost budget exceeded by 140%',
      description: 'Code Review Agent spent $36.10 against a $15.00 daily budget.',
      estimated_waste_usd: 21.1, detected_at: iso(now - 11 * HOUR), resolved_at: iso(now - 9.5 * HOUR),
      gemini_explanation:
        'Spend was driven by an execution loop on PR #1279 that went undetected for 40 minutes.',
      recommended_actions: ['Enable automatic pause when the daily budget is reached.'],
      related_event_ids: idsFor('agt_codereview', 3),
      agent_stopped: false,
    },
    {
      id: 'inc_1036', agent_id: 'agt_pipeline', agent_name: 'Data Pipeline Agent',
      type: 'consecutive_failures', severity: 'medium', status: 'resolved',
      title: 'validate_schema failed 9 times on events_2026_10',
      description: 'A new nullable column was not in the expected schema.',
      estimated_waste_usd: 0.21, detected_at: iso(now - 15 * HOUR), resolved_at: iso(now - 13 * HOUR),
      gemini_explanation: null,
      recommended_actions: ['Update the expected schema to include the new column.'],
      related_event_ids: idsFor('agt_pipeline', 3),
      agent_stopped: false,
    },
    {
      id: 'inc_1035', agent_id: 'agt_codereview', agent_name: 'Code Review Agent',
      type: 'execution_loop', severity: 'critical', status: 'resolved',
      title: 'post_review_comment loop on PR #1279',
      description: 'Agent posted and deleted the same comment 31 times.',
      estimated_waste_usd: 14.9, detected_at: iso(now - 19 * HOUR), resolved_at: iso(now - 18 * HOUR),
      gemini_explanation:
        'A lint check flagged each new comment as a duplicate, which the agent interpreted as a failure and retried.',
      recommended_actions: ['Treat duplicate-comment responses as success.'],
      related_event_ids: idsFor('agt_codereview', 3),
      agent_stopped: false,
    },
  ];
}
