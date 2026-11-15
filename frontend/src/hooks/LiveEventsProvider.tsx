import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Agent, AgentEvent } from '../types/api';
import { api } from '../services';
import { startLiveFeed, type FeedStatus } from '../services/liveFeed';
import { parseUtc } from '../lib/format';
import { useApiQuery } from './useApiQuery';
import { LiveEventsContext, type LiveEventsValue } from './liveEventsContext';

const MAX_EVENTS = 500;

const newestFirst = (a: AgentEvent, b: AgentEvent) => parseUtc(b.timestamp) - parseUtc(a.timestamp);

function merge(prev: AgentEvent[], incoming: AgentEvent[]): AgentEvent[] {
  const seen = new Set(prev.map((e) => e.id));
  const fresh = incoming.filter((e) => !seen.has(e.id));
  if (fresh.length === 0) return prev;
  return [...fresh, ...prev].sort(newestFirst).slice(0, MAX_EVENTS);
}

/**
 * One polling loop for the whole app, shared through context, so the
 * dashboard widget, the Activity page and the header indicator don't each poll.
 */
export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [statusDetail, setStatusDetail] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [buffered, setBuffered] = useState<AgentEvent[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const agents = useApiQuery(() => api.getAgents(), [], { refreshMs: 5_000 });
  const agentsById = useMemo(() => {
    const map: Record<string, Agent> = {};
    agents.data?.forEach((a) => (map[a.id] = a));
    return map;
  }, [agents.data]);

  useEffect(
    () =>
      startLiveFeed({
        onEvents: (incoming) => {
          if (pausedRef.current) setBuffered((prev) => merge(prev, incoming));
          else setEvents((prev) => merge(prev, incoming));
        },
        onStatus: (s, detail) => {
          setStatus(s);
          setStatusDetail(detail);
        },
      }),
    [],
  );

  const value = useMemo<LiveEventsValue>(
    () => ({
      events,
      status,
      statusDetail,
      paused,
      bufferedCount: buffered.length,
      agentsById,
      setPaused: (next) => {
        setPaused(next);
        if (!next) {
          setEvents((prev) => merge(prev, buffered));
          setBuffered([]);
        }
      },
    }),
    [events, status, statusDetail, paused, buffered, agentsById],
  );

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}
