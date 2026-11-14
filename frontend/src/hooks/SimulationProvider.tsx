import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { api, config } from '../services';
import { isMockSimulationRunning } from '../services/mock/mockApi';
import { SimulationContext, type SimulationValue } from './simulationContext';

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState<boolean | null>(config.useMock ? isMockSimulationRunning() : null);
  const [pending, setPending] = useState(false);
  const [lastMessage, setLastMessage] = useState<SimulationValue['lastMessage']>(null);

  const call = useCallback(async (fn: () => Promise<{ running: boolean; message: string }>) => {
    setPending(true);
    try {
      const res = await fn();
      setRunning(res.running);
      setLastMessage({ text: res.message, tone: 'success' });
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
      start: () => call(() => api.startSimulation()),
      stop: () => call(() => api.stopSimulation()),
      trigger: (scenario) => call(() => api.triggerSimulation({ scenario })),
      dismissMessage: () => setLastMessage(null),
    }),
    [running, pending, lastMessage, call],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}
