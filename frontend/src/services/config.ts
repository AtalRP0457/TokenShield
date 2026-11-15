/**
 * Runtime configuration, read once from Vite env vars (see .env.example).
 * Vite only exposes variables prefixed with VITE_ to browser code.
 */
const env = import.meta.env;

export const config = {
  /** Use the in-browser mock backend instead of the real FastAPI server. */
  useMock: (env.VITE_USE_MOCK ?? 'true').toLowerCase() !== 'false',
  /**
   * Empty = same origin: requests go to /api on the Vite dev server, which
   * proxies them to the backend (see vite.config.ts). Set a full URL only to
   * call a backend directly (that requires CORS on the backend).
   */
  apiBaseUrl: (env.VITE_API_BASE_URL ?? '').replace(/\/+$/, ''),
  /** The backend contract asks clients to poll the feed and incidents every 2–3 s. */
  pollIntervalMs: Number(env.VITE_POLL_INTERVAL_MS ?? 2500) || 2500,
  /** Generous: a free online backend can take ~50 s to wake from sleep. */
  requestTimeoutMs: 30_000,
  /** POST /api/incidents/{id}/analyze re-runs Gemini and can take ~30 s. */
  analyzeTimeoutMs: 45_000,
} as const;
