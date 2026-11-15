import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, X, XCircle } from 'lucide-react';
import { api } from '../../services';
import { useLiveEvents } from '../../hooks/useLiveEvents';
import { displayAgentName, perilFor } from '../../lib/labels';
import { plainFor } from '../../lib/plain';
import { formatUsd, parseUtc } from '../../lib/format';
import { loadAlertPrefs, playChime, type AlertPrefs } from '../../lib/alertPrefs';
import { loadWatched, onWatchedChange } from '../../lib/failureWatch';

const POLL_MS = 4_000;
const SHOW_MS = 9_000;
const ALERT_SEVERITIES = new Set(['high', 'critical']);

interface Toast {
  key: string;
  kind: 'peril' | 'failure';
  title: string;
  body: string;
  meta: string;
  to: string;
}

/**
 * Announces, anywhere in the app:
 *  - new high/critical perils, and
 *  - every failed step of heroes you chose to watch ("Alert on every failure").
 * In-app toast + chime + (if allowed) a desktop notification.
 */
export function PerilAlerts() {
  const seen = useRef<Set<string> | null>(null);
  const seenEvents = useRef(new Set<string>());
  const startedAt = useRef(Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [prefs, setPrefs] = useState<AlertPrefs>(loadAlertPrefs);
  const [watched, setWatchedState] = useState<Set<string>>(loadWatched);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const navigate = useNavigate();
  const { events, agentsById } = useLiveEvents();

  useEffect(() => {
    const onChange = () => setPrefs(loadAlertPrefs());
    window.addEventListener('tokenshield:alert-prefs', onChange);
    return () => window.removeEventListener('tokenshield:alert-prefs', onChange);
  }, []);
  useEffect(() => onWatchedChange(() => setWatchedState(loadWatched())), []);

  const announce = (items: Toast[]) => {
    if (items.length === 0) return;
    setToasts((t) => [...items, ...t].slice(0, 4));
    const p = prefsRef.current;
    if (p.sound) void playChime();
    if (p.desktop && 'Notification' in window && Notification.permission === 'granted') {
      for (const it of items.slice(0, 2)) {
        const n = new Notification(it.title, { body: it.body, tag: it.key });
        n.onclick = () => { window.focus(); navigate(it.to); };
      }
    }
  };
  const announceRef = useRef(announce);
  announceRef.current = announce;

  // New perils (polled).
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const list = await api.getIncidents();
        if (!alive) return;
        if (seen.current === null) {
          seen.current = new Set(list.map((i) => i.id)); // don't announce what was already there
          return;
        }
        const fresh = list.filter((i) => !seen.current!.has(i.id));
        fresh.forEach((i) => seen.current!.add(i.id));
        announceRef.current(
          fresh
            .filter((i) => ALERT_SEVERITIES.has(i.severity))
            .map((i) => ({
              key: i.id,
              kind: 'peril' as const,
              title: `${perilFor(i.incident_type).peril} caught on ${displayAgentName(i.agent_name)}`,
              body: `${plainFor(i.incident_type).what} TokenShield paused it.`,
              meta: `${formatUsd(i.estimated_waste)} est. waste · tap to see what happened`,
              to: `/incidents/${i.id}`,
            })),
        );
      } catch {
        /* the pages show connection errors; alerts just try again */
      }
    };
    void check();
    const id = window.setInterval(check, POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // Failed steps of watched heroes (from the shared live feed).
  useEffect(() => {
    if (watched.size === 0) return;
    const fresh = events.filter(
      (e) => e.success === false && watched.has(e.agent_id) && !seenEvents.current.has(e.id) && parseUtc(e.timestamp) >= startedAt.current - 5_000,
    );
    fresh.forEach((e) => seenEvents.current.add(e.id));
    announceRef.current(
      fresh.slice(0, 3).map((e) => {
        const name = displayAgentName(agentsById[e.agent_id]?.name ?? 'A hero');
        return {
          key: e.id,
          kind: 'failure' as const,
          title: `${name} failed a step`,
          body: `${e.tool_name ?? 'A step'} failed${e.error_message ? `: ${e.error_message}` : '.'}`,
          meta: 'Tap to open this hero',
          to: `/agents/${e.agent_id}`,
        };
      }),
    );
  }, [events, watched, agentsById]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = window.setTimeout(() => setToasts((t) => t.slice(0, -1)), SHOW_MS);
    return () => window.clearTimeout(id);
  }, [toasts]);

  if (toasts.length === 0) return null;
  const dismiss = (key: string) => setToasts((t) => t.filter((x) => x.key !== key));
  return (
    <div className="no-print fixed top-16 right-4 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.key} role="alert" className={`flex items-start gap-3 rounded-xl border bg-surface-2 p-3.5 shadow-2xl shadow-black/50 ${t.kind === 'peril' ? 'border-red-500/30' : 'border-orange-400/30'}`}>
          {t.kind === 'peril' ? <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-300" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-orange-300" />}
          <Link to={t.to} onClick={() => dismiss(t.key)} className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">{t.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed break-words text-fg-muted">{t.body}</p>
            <p className="mt-1 text-xs text-fg-subtle">{t.meta}</p>
          </Link>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.key)} className="rounded p-0.5 text-fg-subtle hover:text-fg">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
