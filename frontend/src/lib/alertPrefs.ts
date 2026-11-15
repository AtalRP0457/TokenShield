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

/** A short two-tone chime made with Web Audio (no sound file needed). */
export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const t = ctx.currentTime;
    [880, 587].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.18, t + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.4);
    });
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* audio blocked until the user interacts with the page */
  }
}
