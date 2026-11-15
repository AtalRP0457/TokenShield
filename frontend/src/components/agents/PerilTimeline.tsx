import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Incident } from '../../types/api';
import { formatDateTimeMs, formatUsd, parseUtc } from '../../lib/format';
import { perilFor } from '../../lib/labels';
import { cn } from '../ui/cn';

const WINDOWS = [
  { label: '1h', ms: 60 * 60_000 },
  { label: '6h', ms: 6 * 60 * 60_000 },
  { label: '24h', ms: 24 * 60 * 60_000 },
];

const DOT: Record<string, string> = {
  critical: 'bg-red-400 ring-red-400/30',
  high: 'bg-orange-400 ring-orange-400/30',
  medium: 'bg-amber-300 ring-amber-300/30',
};

/** A strip showing when each peril hit this hero. Hover a mark for details, click to open it. */
export function PerilTimeline({ incidents, now }: { incidents: Incident[]; now: number }) {
  const [win, setWin] = useState(WINDOWS[1]);
  const start = now - win.ms;
  const inWindow = incidents.filter((i) => parseUtc(i.created_at) >= start);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => start + f * win.ms);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-fg-subtle">
          {inWindow.length === 0 ? 'No perils in this window.' : `${inWindow.length} peril${inWindow.length === 1 ? '' : 's'} in the last ${win.label}`}
        </p>
        <div className="flex rounded-md border border-line p-0.5 text-xs" role="group" aria-label="Timeline window">
          {WINDOWS.map((w) => (
            <button
              key={w.label}
              type="button"
              onClick={() => setWin(w)}
              className={cn('rounded px-2 py-0.5', w === win ? 'bg-surface-3 text-fg' : 'text-fg-subtle hover:text-fg')}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-12 rounded-lg border border-line bg-surface-2">
        <div className="absolute inset-x-3 top-1/2 h-px bg-line-strong" />
        {inWindow.map((i) => {
          const x = ((parseUtc(i.created_at) - start) / win.ms) * 100;
          const p = perilFor(i.incident_type);
          return (
            <Link
              key={i.id}
              to={`/incidents/${i.id}`}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-2"
              style={{ left: `calc(12px + (100% - 24px) * ${x / 100})` }}
              aria-label={`${p.peril}: ${i.description}`}
            >
              <span className={cn('block size-3 rounded-full ring-4 transition-transform group-hover:scale-125', DOT[i.severity] ?? DOT.medium, i.status === 'resolved' && 'opacity-40')} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-56 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-3 p-2.5 text-xs shadow-xl group-hover:block">
                <span className="block font-medium text-bronze">{p.peril} · {p.label}</span>
                <span className="mt-0.5 block text-fg-muted">{i.description}</span>
                <span className="mt-1 block text-fg-subtle">{formatDateTimeMs(parseUtc(i.created_at))} · {formatUsd(i.estimated_waste)} est. waste</span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between px-1 text-[10px] text-fg-subtle tabular-nums">
        {ticks.map((t, idx) => (
          <span key={t}>{idx === ticks.length - 1 ? 'now' : new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        ))}
      </div>
    </div>
  );
}
