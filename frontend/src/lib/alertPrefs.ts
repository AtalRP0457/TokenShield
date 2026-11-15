/** Browser-side alert preferences (sound + desktop notification on new perils). */
const KEY = 'tokenshield.alert-prefs.v1';

export interface AlertPrefs {
  sound: boolean;
  desktop: boolean;
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = { sound: true, desktop: false };

export function loadAlertPrefs(): AlertPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_ALERT_PREFS, ...(JSON.parse(raw) as Partial<AlertPrefs>) } : DEFAULT_ALERT_PREFS;
  } catch {
    return DEFAULT_ALERT_PREFS;
  }
}

export function saveAlertPrefs(p: AlertPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new Event('tokenshield:alert-prefs'));
  } catch {
    /* storage blocked: preferences last for this page only */
  }
}

type Ctx = typeof AudioContext;

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const C: Ctx | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctx }).webkitAudioContext;
    ctx = C ? new C() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

/**
 * Browsers (Safari especially) only allow sound once the page has been clicked or typed in.
 * Alerts arrive from background polling, not from a click, so we create ONE audio context and
 * unlock it on the user's first interaction. After that, alert chimes play normally.
 */
function unlock() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  // Play a silent blip: Safari needs real output during a gesture to fully unlock.
  try {
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  // Create the audio context while the page is idle, NOT inside a click: starting the audio
  // system can block the main thread for a moment, which made the first click feel laggy.
  const warm = () => void getCtx();
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 3000 });
  else setTimeout(warm, 1500);

  // A click/keypress only resumes the (already created) context: cheap.
  const once = () => {
    unlock();
    if (ctx?.state === 'running') {
      window.removeEventListener('pointerdown', once, true);
      window.removeEventListener('keydown', once, true);
    }
  };
  window.addEventListener('pointerdown', once, { capture: true, passive: true });
  window.addEventListener('keydown', once, { capture: true, passive: true });
}

/** True once the browser allows this page to play sound. */
export const soundUnlocked = () => ctx?.state === 'running';

/**
 * A short two-tone chime made with Web Audio (no sound file needed).
 * Resolves to false if the browser is still blocking sound (page not clicked yet).
 */
export async function playChime(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state !== 'running') await c.resume();
  } catch {
    /* still blocked */
  }
  if (c.state !== 'running') return false;
  const t = c.currentTime + 0.02;
  [880, 587].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const start = t + i * 0.18;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.45);
  });
  return true;
}
