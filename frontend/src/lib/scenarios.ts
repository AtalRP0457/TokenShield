import { CloudLightning, Music, Sailboat, Tornado, Wind, type LucideIcon } from 'lucide-react';
import type { SimulationScenario } from '../types/api';

/** Demo scenarios from POST /api/simulation/trigger, with their Odyssey framing. */
export const SCENARIOS: { id: SimulationScenario; label: string; description: string; icon: LucideIcon; recommended?: boolean }[] = [
  { id: 'repeating', label: 'Sing the Sirens’ song', description: 'Repeated tool call: fails 5× → incident → agent paused', icon: Music, recommended: true },
  { id: 'sequence_loop', label: 'Summon Charybdis', description: 'Sequence loop: the agent circles the same steps', icon: Tornado },
  { id: 'failing', label: 'Raise Poseidon’s storm', description: 'Consecutive failures from an upstream API', icon: CloudLightning },
  { id: 'token_heavy', label: 'Open Aeolus’ bag', description: 'Token-heavy agent blows through its budget', icon: Wind },
  { id: 'healthy', label: 'Calm seas', description: 'A healthy agent, for comparison', icon: Sailboat },
];

export const scenarioLabel = (id: string) => SCENARIOS.find((s) => s.id === id)?.label ?? id;
