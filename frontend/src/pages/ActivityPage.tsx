import { useMemo, useState } from 'react';
import { AlertOctagon, Pause, Play } from 'lucide-react';
import { useLiveEvents } from '../hooks/useLiveEvents';
import { useNow } from '../hooks/useNow';
import { config } from '../services';
import { displayAgentName, eventMeta, TONE_CLASSES } from '../lib/labels';
import { parseUtc } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { describeEvent } from '../components/activity/EventRow';
import { cn } from '../components/ui/cn';

export function ActivityPage() {
  const { events, status, paused, setPaused, bufferedCount, agentsById } = useLiveEvents();
  const now = useNow(5_000);
  /** Event types are open-ended strings, so we track the ones the user switched OFF. */
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [agent, setAgent] = useState('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    events.forEach((e) => c.set(e.event_type, (c.get(e.event_type) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);
  const failureCount = events.filter((e) => e.success === false).length;

  const agentOptions = useMemo(() => {
    const ids = new Set(events.map((e) => e.agent_id));
    return [...ids]
      .map((id) => ({ value: id, label: displayAgentName(agentsById[id]?.name ?? `Agent ${id.slice(0, 8)}`) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [events, agentsById]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => !hidden.has(e.event_type))
      .filter((e) => !failuresOnly || e.success === false)
      .filter((e) => agent === 'all' || e.agent_id === agent)
      .filter((e) => !q || describeEvent(e).toLowerCase().includes(q) || (e.model ?? '').toLowerCase().includes(q))
      .slice(0, 200);
  }, [events, hidden, failuresOnly, agent, query]);

  const perMinute = events.filter((e) => now - parseUtc(e.timestamp) < 60_000).length;
  const seconds = (config.pollIntervalMs / 1000).toFixed(1).replace(/\.0$/, '');

  const toggle = (t: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <>
      <PageHeader
        title="Ship's log"
        description={`Live activity from every agent, refreshed every ${seconds}s${status === 'offline' ? ' (offline)' : ''}. ${perMinute} events in the last minute.`}
        actions={
          <Button size="sm" variant={paused ? 'primary' : 'secondary'} icon={paused ? Play : Pause} onClick={() => setPaused(!paused)}>
            {paused ? `Resume${bufferedCount ? ` (${bufferedCount} new)` : ''}` : 'Pause'}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by event type">
        <button
          type="button"
          aria-pressed={failuresOnly}
          onClick={() => setFailuresOnly((f) => !f)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ring-1 ring-inset transition-colors',
            failuresOnly ? TONE_CLASSES.danger : 'text-fg-subtle ring-line hover:text-fg-muted',
          )}
        >
          <AlertOctagon className="size-3.5" />
          Failures only
          <span className="font-mono opacity-70">{failureCount}</span>
        </button>
        {counts.map(([t, n]) => {
          const meta = eventMeta(t);
          const on = !hidden.has(t);
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
              <span className="font-mono opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search tools, errors or models" className="sm:w-64" />
          <Select aria-label="Filter by agent" value={agent} onChange={(e) => setAgent(e.target.value)} className="sm:w-56"
            options={[{ value: 'all', label: 'All agents' }, ...agentOptions]} />
          <p className="whitespace-nowrap text-xs text-fg-subtle sm:ml-auto">
            {paused && <span className="mr-2 text-amber-300">Paused</span>}
            Showing {visible.length} of {events.length}
          </p>
        </div>
        <ActivityFeed
          events={visible}
          loading={status === 'connecting'}
          emptyTitle={events.length ? 'No events match these filters' : 'Waiting for events'}
          emptyDescription={events.length ? 'Turn event types back on or clear the search.' : 'Start a simulation to see agent activity.'}
        />
      </Card>
    </>
  );
}
