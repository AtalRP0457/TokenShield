import { useState } from 'react';
import { Bell, BellRing, CheckCircle2, MessageSquare, Mail, Sparkles, Volume2, XCircle } from 'lucide-react';
import { api, config } from '../../services';
import { useApiQuery } from '../../hooks/useApiQuery';
import { loadAlertPrefs, playChime, saveAlertPrefs, type AlertPrefs } from '../../lib/alertPrefs';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze ${checked ? 'bg-bronze' : 'bg-surface-3'}`}
    >
      <span
        aria-hidden
        className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-150 ease-out will-change-transform"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}

const CHANNELS = [
  { key: 'discord', label: 'Discord', icon: MessageSquare, env: 'DISCORD_WEBHOOK_URL' },
  { key: 'slack', label: 'Slack', icon: MessageSquare, env: 'SLACK_WEBHOOK_URL' },
  { key: 'email', label: 'Email', icon: Mail, env: 'SMTP_HOST, ALERT_EMAIL_TO …' },
  { key: 'gemini', label: 'Gemini (the Oracle)', icon: Sparkles, env: 'GEMINI_API_KEY' },
] as const;

/** In-browser alerts (sound, desktop popups) and which server-side channels are configured. */
export function AlertSettingsCard() {
  const [prefs, setPrefs] = useState<AlertPrefs>(loadAlertPrefs);
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const status = useApiQuery(() => api.getNotificationStatus(), []);

  const [soundMsg, setSoundMsg] = useState<string | null>(null);
  const testSound = async () => {
    const ok = await playChime();
    setSoundMsg(ok ? null : 'Your browser is blocking sound. Check the tab is not muted and your volume is up, then try again.');
  };

  const update = (next: AlertPrefs) => {
    setPrefs(next);
    saveAlertPrefs(next);
  };

  const enableDesktop = async (on: boolean) => {
    if (!on) return update({ ...prefs, desktop: false });
    if (perm === 'unsupported' || perm === 'denied') return;
    update({ ...prefs, desktop: true }); // switch moves immediately
    if (Notification.permission === 'granted') return;
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result !== 'granted') update({ ...prefs, desktop: false });
  };

  return (
    <Card className="mt-4">
      <CardHeader title="Alerts" description="How TokenShield gets your attention when it catches a high or critical peril" />
      <CardBody className="space-y-4">
        <div className="flex items-center gap-4">
          <Volume2 className="size-4 text-fg-subtle" />
          <div className="flex-1">
            <p className="text-sm text-fg">Play a sound</p>
            <p className="text-xs text-fg-subtle">A short chime while this dashboard is open. Click anywhere on the page once after opening it so the browser allows sound.</p>
            {soundMsg && <p role="alert" className="mt-1 text-xs text-amber-300">{soundMsg}</p>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => void testSound()}>Test</Button>
          <Toggle label="Play a sound" checked={prefs.sound} onChange={(v) => { update({ ...prefs, sound: v }); if (v) window.setTimeout(() => void playChime(), 180); }} />
        </div>
        <div className="flex items-center gap-4">
          {prefs.desktop ? <BellRing className="size-4 text-fg-subtle" /> : <Bell className="size-4 text-fg-subtle" />}
          <div className="flex-1">
            <p className="text-sm text-fg">Desktop notifications</p>
            <p className="text-xs text-fg-subtle">
              {perm === 'unsupported'
                ? 'This browser does not support notifications.'
                : perm === 'denied'
                  ? 'Blocked in your browser settings. Allow notifications for this site to turn this on.'
                  : 'A popup even when this tab is in the background.'}
            </p>
          </div>
          <Toggle label="Desktop notifications" checked={prefs.desktop} onChange={(v) => void enableDesktop(v)} />
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-2 text-sm text-fg">Server alert channels</p>
          {config.useMock ? (
            <p className="text-xs text-fg-subtle">Demo mode: Discord, Slack and email alerts are sent by the real backend. Set them in the backend's .env file.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {CHANNELS.map((c) => {
                const on = status.data?.[c.key];
                return (
                  <li key={c.key} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                    <c.icon className="size-4 text-fg-subtle" />
                    <span className="flex-1 text-sm text-fg">{c.label}</span>
                    {status.data === undefined ? (
                      <span className="text-xs text-fg-subtle">…</span>
                    ) : on ? (
                      <Badge tone="success"><CheckCircle2 className="size-3" /> On</Badge>
                    ) : (
                      <span title={`Set ${c.env} in the backend .env`}><Badge tone="neutral"><XCircle className="size-3" /> Off</Badge></span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!config.useMock && <p className="mt-2 text-xs text-fg-subtle">To turn a channel on, add its setting to the backend's .env file and restart the backend.</p>}
        </div>
      </CardBody>
    </Card>
  );
}
