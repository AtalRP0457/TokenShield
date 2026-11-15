/** Heroes you asked to be alerted about on EVERY failed step (stored in this browser). */
const KEY = 'tokenshield.failure-watch.v1';
const EVENT = 'tokenshield:failure-watch';

export function loadWatched(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function setWatched(agentId: string, on: boolean) {
  const s = loadWatched();
  if (on) s.add(agentId);
  else s.delete(agentId);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onWatchedChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
