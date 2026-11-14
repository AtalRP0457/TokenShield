import { useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useLiveEvents } from '../hooks/useLiveEvents';
import { useNow } from '../hooks/useNow';
import type { EventType } from '../types/api';
import { EVENT_TYPE, TONE_CLASSES } from '../lib/labels';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { cn } from '../components/ui/cn';

const ALL_TYPES = Object.keys(EVENT_TYPE) as EventType[];

export function ActivityPage() {
  const { events, status, paused, setPaused, bufferedCount } = useLiveEvents();
  const now = useNow(5_000);
  const [types, setTypes] = useState<Set<EventType>>(new Set(ALL_TYPES));
  const [agent, setAgent] = useState('all');
  const [query, setQuery] = useState('');

  const agents = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach((e) => map.set(e.agent_id, e.agent_name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => types.has(e.type))
      .filter((e) => agent === 'all' || e.agent_id === agent)
      .filter((e) => !q || e.message.toLowerCase().includes(q) || (e.tool_name ?? '').toLowerCase().includes(q))
      .slice(0, 200);
  }, [events, types, agent, query]);

  const perMinute = events.filter((e) => now - Date.parse(e.timestamp) < 60_000).length;
  const counts = useMemo(() => {
    const c = {} as Record<EventType, number>;
    events.forEach((e) => (c[e.type] = (c[e.type] ?? 0) + 1));
    return c;
  }, [events]);

  const toggle = (t: EventType) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <>
      <PageHeader
        title="Ship's log"
        description={`Live activity from every agent (${status === 'mock' ? 'mock simulator' : status}). ${perMinute} events in the last minute.`}
        actions={
          <Button size="sm" variant={paused ? 'primary' : 'secondary'} icon={paused ? Play : Pause} onClick={() => setPaused(!paused)}>
            {paused ? `Resume${bufferedCount ? ` (${bufferedCount} new)` : ''}` : 'Pause'}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by event type">
        {ALL_TYPES.map((t) => {
          const meta = EVENT_TYPE[t];
          const on = types.has(t);
          const Icon = meta.icon;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ring-1 ring-inset transition-colors',
                on ? TONE_CLASSES[meta.tone] : 'text-fg-subtle ring-line hover:text-fg-muted',
              )}
            >
              <Icon className="size-3.5" />
              {meta.label}
              <span className="font-mono opacity-70">{counts[t] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search messages or tools" className="sm:w-64" />
          <Select aria-label="Filter by agent" value={agent} onChange={(e) => setAgent(e.target.value)} className="sm:w-52"
            options={[{ value: 'all', label: 'All agents' }, ...agents.map(([value, label]) => ({ value, label }))]} />
          <p className="text-xs text-fg-subtle sm:ml-auto">
            {paused && <span className="mr-2 text-amber-300">Paused</span>}
            Showing {visible.length} of {events.length}
          </p>
        </div>
        <ActivityFeed
          events={visible}
          loading={status === 'connecting'}
          emptyTitle={events.length ? 'No events match these filters' : 'Waiting for events'}
          emptyDescription={events.length ? 'Enable more event types or clear the search.' : undefined}
        />
      </Card>
    </>
  );
}
