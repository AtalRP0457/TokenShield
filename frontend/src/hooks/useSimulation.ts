import { useContext } from 'react';
import { SimulationContext, type SimulationValue } from './simulationContext';

export function useSimulation(): SimulationValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used inside <SimulationProvider>');
  return ctx;
}
