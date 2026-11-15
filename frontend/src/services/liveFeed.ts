/**
 * Live event feed. The backend has no WebSocket, so (per the contract) we poll
 * GET /api/events/recent every 2–3 s. Mock mode uses the same path, so both
 * modes behave identically.
 *
 * Consumers receive batches and must de-duplicate by `id` — consecutive polls
 * overlap on purpose. LiveEventsProvider does that.
 */
import type { AgentEvent } from '../types/api';
import { api } from './index';
import { config } from './config';

export type FeedStatus = 'connecting' | 'polling' | 'offline';

export interface LiveFeedHandlers {
  onEvents: (events: AgentEvent[]) => void;
  onStatus: (status: FeedStatus, detail?: string) => void;
}

const BATCH = 50;

export function startLiveFeed({ onEvents, onStatus }: LiveFeedHandlers): () => void {
  let stopped = false;
  let inFlight = false;

  onStatus('connecting');

  const poll = async () => {
    if (inFlight) return; // never stack requests on a slow backend
    inFlight = true;
    try {
      const events = await api.getRecentEvents(BATCH);
      if (stopped) return;
      onEvents(events);
      onStatus('polling');
    } catch (err) {
      if (!stopped) onStatus('offline', err instanceof Error ? err.message : String(err));
    } finally {
      inFlight = false;
    }
  };

  void poll();
  const timer = window.setInterval(() => void poll(), config.pollIntervalMs);

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}
