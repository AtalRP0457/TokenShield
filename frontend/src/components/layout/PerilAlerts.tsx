import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import type { Incident } from '../../types/api';
import { api } from '../../services';
import { displayAgentName, perilFor } from '../../lib/labels';
import { plainFor } from '../../lib/plain';
import { formatUsd } from '../../lib/format';
import { loadAlertPrefs, playChime, type AlertPrefs } from '../../lib/alertPrefs';

const POLL_MS = 4_000;
const SHOW_MS = 9_000;
const ALERT_SEVERITIES = new Set(['high', 'critical']);

/**
 * Watches for new high/critical perils anywhere in the app and announces them:
 * an in-app toast, a chime and (if allowed) a desktop notification.
 */
export function PerilAlerts() {
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Incident[]>([]);
  const [prefs, setPrefs] = useState<AlertPrefs>(loadAlertPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const navigate = useNavigate();

  useEffect(() => {
    const onChange = () => setPrefs(loadAlertPrefs());
    window.addEventListener('tokenshield:alert-prefs', onChange);
    return () => window.removeEventListener('tokenshield:alert-prefs', onChange);
  }, []);

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
        const loud = fresh.filter((i) => ALERT_SEVERITIES.has(i.severity));
        if (loud.length === 0) return;
        setToasts((t) => [...loud, ...t].slice(0, 3));
        const p = prefsRef.current;
        if (p.sound) playChime();
        if (p.desktop && 'Notification' in window && Notification.permission === 'granted') {
          for (const i of loud.slice(0, 2)) {
            const n = new Notification(`${perilFor(i.incident_type).peril} caught: ${displayAgentName(i.agent_name)}`, {
              body: `${plainFor(i.incident_type).what} TokenShield paused it.`,
              tag: i.id,
            });
            n.onclick = () => { window.focus(); navigate(`/incidents/${i.id}`); };
          }
        }
      } catch {
        /* the pages show connection errors; alerts just try again */
      }
    };
    void check();
    const id = window.setInterval(check, POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [navigate]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = window.setTimeout(() => setToasts((t) => t.slice(0, -1)), SHOW_MS);
    return () => window.clearTimeout(id);
  }, [toasts]);

  if (toasts.length === 0) return null;
  return (
    <div className="no-print fixed top-16 right-4 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="assertive">
      {toasts.map((i) => {
        const p = perilFor(i.incident_type);
        return (
          <div key={i.id} role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-surface-2 p-3.5 shadow-2xl shadow-black/50">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-300" />
            <Link to={`/incidents/${i.id}`} onClick={() => setToasts((t) => t.filter((x) => x.id !== i.id))} className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{p.peril} caught on {displayAgentName(i.agent_name)}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{plainFor(i.incident_type).what} TokenShield paused it.</p>
              <p className="mt-1 text-xs text-fg-subtle">{formatUsd(i.estimated_waste)} est. waste · tap to see what happened</p>
            </Link>
            <button type="button" aria-label="Dismiss" onClick={() => setToasts((t) => t.filter((x) => x.id !== i.id))} className="rounded p-0.5 text-fg-subtle hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
