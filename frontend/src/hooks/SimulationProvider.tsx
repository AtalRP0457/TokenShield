import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { api, config } from '../services';
import { isMockSimulationRunning } from '../services/mock/mockApi';
import { scenarioLabel } from '../lib/scenarios';
import { SimulationContext, type SimulationValue } from './simulationContext';

/** Demo controls → POST /api/simulation/start | stop | trigger?scenario=… */
export function SimulationProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState<boolean | null>(config.useMock ? isMockSimulationRunning() : null);
  const [pending, setPending] = useState(false);
  const [lastMessage, setLastMessage] = useState<SimulationValue['lastMessage']>(null);

  const call = useCallback(async (fn: () => Promise<string>) => {
    setPending(true);
    try {
      setLastMessage({ text: await fn(), tone: 'success' });
    } catch (err) {
      setLastMessage({ text: err instanceof Error ? err.message : 'Simulation request failed', tone: 'error' });
    } finally {
      setPending(false);
    }
  }, []);

  const value = useMemo<SimulationValue>(
    () => ({
      running,
      pending,
      lastMessage,
      start: () =>
        call(async () => {
          const res = await api.startSimulation();
          setRunning(true);
          return `Simulation started: ${res.started.length} scenarios running`;
        }),
      stop: () =>
        call(async () => {
          await api.stopSimulation();
          setRunning(false);
          return 'Simulation stopped';
        }),
      trigger: (scenario) =>
        call(async () => {
          const res = await api.triggerSimulation(scenario);
          return `${scenarioLabel(res.started)} started${scenario === 'healthy' ? '' : '. Watch the Perils page'}`;
        }),
      dismissMessage: () => setLastMessage(null),
    }),
    [running, pending, lastMessage, call],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}
