/**
 * Demo site only: talks to the Vercel server function at /api/gemini (frontend/api/gemini.ts),
 * which holds the Gemini key. Returns null on any problem so callers fall back to built-in text.
 */
let disabled = false; // set when the deployment has no key, so we stop asking

export async function demoGemini<T>(body: unknown, timeoutMs = 30_000): Promise<T | null> {
  if (disabled) return null;
  try {
    const r = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) {
      if (r.status === 404) disabled = true; // no server function here (e.g. local dev)
      if (r.status === 503) {
        const detail = ((await r.json().catch(() => ({}))) as { detail?: string }).detail ?? '';
        if (detail.includes('not configured')) disabled = true;
      }
      return null;
    }
    return (await r.json()) as T;
  } catch {
    return null;
  }
}
