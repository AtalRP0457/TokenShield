import type { TokenShieldApi } from './apiClient';
import { request } from './http';

const enc = encodeURIComponent;

/** Real implementation: a 1:1 mapping of interface methods to FastAPI endpoints. */
export const realApi: TokenShieldApi = {
  registerAgent: (body) => request('POST', '/api/agents/register', body),
  ingestEvent: (body) => request('POST', '/api/events', body),
  getAgents: () => request('GET', '/api/agents'),
  getAgent: (id) => request('GET', `/api/agents/${enc(id)}`),
  getAgentEvents: (id) => request('GET', `/api/agents/${enc(id)}/events`),
  pauseAgent: (id, body) => request('POST', `/api/agents/${enc(id)}/pause`, body),
  resumeAgent: (id) => request('POST', `/api/agents/${enc(id)}/resume`),
  getOverview: () => request('GET', '/api/metrics/overview'),
  getTokenMetrics: () => request('GET', '/api/metrics/tokens'),
  getCostMetrics: () => request('GET', '/api/metrics/cost'),
  getAgentMetrics: () => request('GET', '/api/metrics/agents'),
  getIncidents: () => request('GET', '/api/incidents'),
  getIncident: (id) => request('GET', `/api/incidents/${enc(id)}`),
  updateIncident: (id, body) => request('PATCH', `/api/incidents/${enc(id)}`, body),
  startSimulation: () => request('POST', '/api/simulation/start'),
  stopSimulation: () => request('POST', '/api/simulation/stop'),
  triggerSimulation: (body) => request('POST', '/api/simulation/trigger', body),
  getHealth: () => request('GET', '/api/health'),
};
