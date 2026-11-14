import { useEffect, useRef } from 'react';
import { Radio } from 'lucide-react';
import type { AgentEvent } from '../../types/api';
import { EmptyState, LoadingState } from '../ui/States';
import { EventRow } from './EventRow';

interface ActivityFeedProps {
  events: AgentEvent[];
  loading?: boolean;
  compact?: boolean;
  showAgent?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Renders a list of events. Remembers which ids it has already shown so only
 * genuinely new rows get the highlight animation (not the whole list on mount).
 */
export function ActivityFeed({ events, loading, compact, showAgent, emptyTitle = 'Waiting for events', emptyDescription = 'Agent activity will stream in here in real time.' }: ActivityFeedProps) {
  const seen = useRef<Set<string> | null>(null);
  const firstRender = seen.current === null;
  if (seen.current === null) seen.current = new Set(events.map((e) => e.id));

  useEffect(() => {
    events.forEach((e) => seen.current!.add(e.id));
  }, [events]);

  if (loading && events.length === 0) return <LoadingState rows={6} className="p-4" />;
  if (events.length === 0) return <EmptyState icon={Radio} title={emptyTitle} description={emptyDescription} />;

  return (
    <ul className="divide-y divide-line">
      {events.map((e) => (
        <EventRow key={e.id} event={e} compact={compact} showAgent={showAgent} isNew={!firstRender && !seen.current!.has(e.id)} />
      ))}
    </ul>
  );
}
