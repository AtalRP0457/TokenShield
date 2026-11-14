import { createContext } from 'react';
import type { SimulationScenario } from '../types/api';

// Kept separate from the provider component so Vite Fast Refresh never
// recreates the context object (which would orphan existing consumers).
export interface SimulationValue {
  /** null = unknown (the backend has no "get simulation status" endpoint). */
  running: boolean | null;
  pending: boolean;
  lastMessage: { text: string; tone: 'success' | 'error' } | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  trigger: (scenario: SimulationScenario) => Promise<void>;
  dismissMessage: () => void;
}

export const SimulationContext = createContext<SimulationValue | null>(null);
