/**
 * Live event feed with three transports, chosen automatically:
 *
 *   mock mode        → in-memory simulator (no network)
 *   VITE_WS_URL set  → WebSocket; on failure falls back to polling and keeps
 *                      retrying the socket with backoff
 *   otherwise        → polling GET /api/agents + GET /api/agents/{id}/events
 *
 * Consumers get batches of events and must de-duplicate by `id` (polling and
 * reconnects can deliver the same event twice). useLiveEvents does that.
 */
import type { AgentEvent } from '../types/api';
import { api } from './index';
import { config } from './config';
import { subscribeMockEvents } from './mock/mockApi';

export type FeedStatus = 'connecting' | 'mock' | 'websocket' | 'polling' | 'offline';

export interface LiveFeedHandlers {
  onEvents: (events: AgentEvent[]) => void;
  onStatus: (status: FeedStatus, detail?: string) => void;
}

/** Fetch recent events across all agents (there is no global events endpoint). */
export async function fetchRecentEvents(): Promise<AgentEvent[]> {
  const agents = await api.getAgents();
  const results = await Promise.allSettled(agents.map((a) => api.getAgentEvents(a.id)));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

/** Accepts a single event, an array of events, or `{ data: ... }` envelopes. */
function parseSocketMessage(raw: string): AgentEvent[] {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return [];
  }
  const unwrap = (value: unknown): AgentEvent[] => {
    if (Array.isArray(value)) return value.flatMap(unwrap);
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (typeof obj.id === 'string' && typeof obj.agent_id === 'string' && typeof obj.type === 'string') {
        return [obj as unknown as AgentEvent];
      }
      if ('data' in obj) return unwrap(obj.data);
    }
    return [];
  };
  return unwrap(payload);
}

export function startLiveFeed({ onEvents, onStatus }: LiveFeedHandlers): () => void {
  let stopped = false;
  let pollTimer: number | undefined;
  let retryTimer: number | undefined;
  let socket: WebSocket | null = null;
  let unsubscribeMock: (() => void) | undefined;
  let wsRetryDelay = 2_000;

  onStatus('connecting');

  // 1. Backfill history so the feed is never empty on load.
  fetchRecentEvents()
    .then((events) => !stopped && onEvents(events))
    .catch((err: unknown) => !stopped && onStatus('offline', err instanceof Error ? err.message : String(err)));

  // 2a. Mock transport.
  if (config.useMock) {
    unsubscribeMock = subscribeMockEvents((e) => onEvents([e]));
    onStatus('mock');
    return () => {
      stopped = true;
      unsubscribeMock?.();
    };
  }

  // 2b. Polling transport.
  const poll = async () => {
    try {
      const events = await fetchRecentEvents();
      if (stopped) return;
      onEvents(events);
      if (!socket || socket.readyState !== WebSocket.OPEN) onStatus('polling');
    } catch (err) {
      if (!stopped) onStatus('offline', err instanceof Error ? err.message : String(err));
    }
  };
  const startPolling = () => {
    if (pollTimer !== undefined) return;
    pollTimer = window.setInterval(poll, config.pollIntervalMs);
  };
  const stopPolling = () => {
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  };

  // 2c. WebSocket transport (preferred when configured).
  const connectSocket = () => {
    if (stopped || !config.wsUrl) return;
    try {
      socket = new WebSocket(config.wsUrl);
    } catch {
      scheduleRetry();
      return;
    }
    socket.onopen = () => {
      wsRetryDelay = 2_000;
      stopPolling();
      onStatus('websocket');
    };
    socket.onmessage = (msg) => {
      const events = parseSocketMessage(String(msg.data));
      if (events.length) onEvents(events);
    };
    socket.onclose = () => {
      socket = null;
      if (stopped) return;
      startPolling();
      onStatus('polling', 'WebSocket disconnected — polling until it reconnects');
      scheduleRetry();
    };
  };
  const scheduleRetry = () => {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(connectSocket, wsRetryDelay);
    wsRetryDelay = Math.min(wsRetryDelay * 2, 30_000);
  };

  if (config.wsUrl) {
    connectSocket();
  } else {
    startPolling();
    onStatus('polling');
  }

  return () => {
    stopped = true;
    stopPolling();
    window.clearTimeout(retryTimer);
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  };
}
