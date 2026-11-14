import { createContext } from 'react';
import type { AgentEvent } from '../types/api';
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
}

export const LiveEventsContext = createContext<LiveEventsValue | null>(null);
