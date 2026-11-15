import type {
  Agent,
  AgentGuards,
  CreateAgentRequest,
  TestFailureResponse,
  GuardValues,
  NotificationStatus,
  OracleAnswer,
  AgentEvent,
  HealthResponse,
  Incident,
  IncidentStatus,
  MetricsOverview,
  ResumeAgentResponse,
  SimulationScenario,
  StartSimulationResponse,
  StopSimulationResponse,
  TimeseriesResponse,
  TriggerSimulationResponse,
  UpdateIncidentRequest,
} from '../types/api';

/**
 * The single interface every data source implements (real FastAPI client and
 * in-browser mock). Pages and hooks only ever talk to this. One method per
 * backend endpoint the UI uses.
 */
export interface TokenShieldApi {
  getOverview(): Promise<MetricsOverview>;
  getTimeseries(minutes: number): Promise<TimeseriesResponse>;
  getAgents(): Promise<Agent[]>;
  getAgent(agentId: string): Promise<Agent>;
  getAgentEvents(agentId: string, limit?: number): Promise<AgentEvent[]>;
  resumeAgent(agentId: string): Promise<ResumeAgentResponse>;
  getRecentEvents(limit?: number): Promise<AgentEvent[]>;
  getIncidents(status?: IncidentStatus): Promise<Incident[]>;
  getIncident(incidentId: string): Promise<Incident>;
  updateIncident(incidentId: string, body: UpdateIncidentRequest): Promise<Incident>;
  analyzeIncident(incidentId: string): Promise<Incident>;
  startSimulation(): Promise<StartSimulationResponse>;
  stopSimulation(): Promise<StopSimulationResponse>;
  triggerSimulation(scenario: SimulationScenario): Promise<TriggerSimulationResponse>;
  getHealth(): Promise<HealthResponse>;
  createAgent(body: CreateAgentRequest): Promise<Agent>;
  sendTestFailure(agentId: string): Promise<TestFailureResponse>;
  getAgentGuards(agentId: string): Promise<AgentGuards>;
  updateAgentGuards(agentId: string, body: GuardValues): Promise<AgentGuards>;
  askOracle(question: string, agentId?: string): Promise<OracleAnswer>;
  getNotificationStatus(): Promise<NotificationStatus>;
}
