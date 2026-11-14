import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgentEvent } from '../types/api';
import { startLiveFeed, type FeedStatus } from '../services/liveFeed';
import { LiveEventsContext, type LiveEventsValue } from './liveEventsContext';

const MAX_EVENTS = 500;

/**
 * One live connection for the whole app, shared through context, so the
 * dashboard widget, the Activity page and the header indicator don't each open
 * their own WebSocket.
 */
export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [statusDetail, setStatusDetail] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [buffered, setBuffered] = useState<AgentEvent[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const merge = (prev: AgentEvent[], incoming: AgentEvent[]) => {
      const seen = new Set(prev.map((e) => e.id));
      const fresh = incoming.filter((e) => !seen.has(e.id));
      if (fresh.length === 0) return prev;
      return [...fresh, ...prev]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, MAX_EVENTS);
    };

    return startLiveFeed({
      onEvents: (incoming) => {
        if (pausedRef.current) setBuffered((prev) => merge(prev, incoming));
        else setEvents((prev) => merge(prev, incoming));
      },
      onStatus: (s, detail) => {
        setStatus(s);
        setStatusDetail(detail);
      },
    });
  }, []);

  const value = useMemo<LiveEventsValue>(
    () => ({
      events,
      status,
      statusDetail,
      paused,
      bufferedCount: buffered.length,
      setPaused: (next) => {
        setPaused(next);
        if (!next) {
          // flush what arrived while paused
          setEvents((prev) => {
            const seen = new Set(prev.map((e) => e.id));
            return [...buffered.filter((e) => !seen.has(e.id)), ...prev]
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
              .slice(0, MAX_EVENTS);
          });
          setBuffered([]);
        }
      },
    }),
    [events, status, statusDetail, paused, buffered],
  );

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}
