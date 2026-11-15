import type { TokenShieldApi } from './apiClient';
import { config } from './config';
import { request } from './http';

const enc = encodeURIComponent;

/** Real implementation: a 1:1 mapping of interface methods to FastAPI endpoints (contract v2). */
export const realApi: TokenShieldApi = {
  getOverview: () => request('GET', '/api/metrics/overview'),
  getTimeseries: (minutes) => request('GET', '/api/metrics/timeseries', { query: { minutes } }),
  getAgents: () => request('GET', '/api/agents'),
  getAgent: (id) => request('GET', `/api/agents/${enc(id)}`),
  getAgentEvents: (id, limit = 100) => request('GET', `/api/agents/${enc(id)}/events`, { query: { limit } }),
  resumeAgent: (id) => request('POST', `/api/agents/${enc(id)}/resume`),
  getRecentEvents: (limit = 50) => request('GET', '/api/events/recent', { query: { limit } }),
  getIncidents: (status) => request('GET', '/api/incidents', { query: { status } }),
  getIncident: (id) => request('GET', `/api/incidents/${enc(id)}`),
  updateIncident: (id, body) => request('PATCH', `/api/incidents/${enc(id)}`, { body }),
  analyzeIncident: (id) => request('POST', `/api/incidents/${enc(id)}/analyze`, { timeoutMs: config.analyzeTimeoutMs }),
  startSimulation: () => request('POST', '/api/simulation/start'),
  stopSimulation: () => request('POST', '/api/simulation/stop'),
  triggerSimulation: (scenario) => request('POST', '/api/simulation/trigger', { query: { scenario } }),
  getHealth: () => request('GET', '/api/health'),
  createAgent: (body) => request('POST', '/api/agents', { body }),
  sendTestFailure: (id) => request('POST', `/api/agents/${enc(id)}/test-failure`),
  getAgentGuards: (id) => request('GET', `/api/agents/${enc(id)}/guards`),
  updateAgentGuards: (id, body) => request('PUT', `/api/agents/${enc(id)}/guards`, { body }),
  askOracle: (question, agentId) =>
    request('POST', '/api/oracle/ask', { body: { question, agent_id: agentId ?? null }, timeoutMs: config.analyzeTimeoutMs }),
  getNotificationStatus: () => request('GET', '/api/notifications/status'),
};
