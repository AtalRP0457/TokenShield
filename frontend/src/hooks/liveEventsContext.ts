import { createContext } from 'react';
import type { Agent, AgentEvent } from '../types/api';
import type { FeedStatus } from '../services/liveFeed';

// Separate file so Fast Refresh keeps a stable context object.
export interface LiveEventsValue {
  events: AgentEvent[]; // newest first, de-duplicated
  status: FeedStatus;
  statusDetail?: string;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  /** Events that arrived while paused (shown as a counter). */
  bufferedCount: number;
  /** Events carry only agent_id, so the feed keeps an id → agent directory. */
  agentsById: Record<string, Agent>;
}

export const LiveEventsContext = createContext<LiveEventsValue | null>(null);
