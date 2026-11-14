import type {
  Agent,
  AgentDetail,
  AgentEvent,
  AgentMetric,
  CostMetricPoint,
  HealthResponse,
  Incident,
  IngestEventRequest,
  MetricsOverview,
  RegisterAgentRequest,
  SimulationStatus,
  TokenMetricPoint,
  TriggerSimulationRequest,
  UpdateIncidentRequest,
} from '../types/api';

/**
 * The single interface every data source implements. Pages and hooks only
 * ever talk to this — they never know whether data is mocked or real.
 * One method per backend endpoint.
 */
export interface TokenShieldApi {
  registerAgent(body: RegisterAgentRequest): Promise<Agent>;
  ingestEvent(body: IngestEventRequest): Promise<AgentEvent>;
  getAgents(): Promise<Agent[]>;
  getAgent(agentId: string): Promise<AgentDetail>;
  getAgentEvents(agentId: string): Promise<AgentEvent[]>;
  getOverview(): Promise<MetricsOverview>;
  getTokenMetrics(): Promise<TokenMetricPoint[]>;
  getCostMetrics(): Promise<CostMetricPoint[]>;
  getAgentMetrics(): Promise<AgentMetric[]>;
  getIncidents(): Promise<Incident[]>;
  getIncident(incidentId: string): Promise<Incident>;
  updateIncident(incidentId: string, body: UpdateIncidentRequest): Promise<Incident>;
  startSimulation(): Promise<SimulationStatus>;
  stopSimulation(): Promise<SimulationStatus>;
  triggerSimulation(body: TriggerSimulationRequest): Promise<SimulationStatus>;
  getHealth(): Promise<HealthResponse>;
}
