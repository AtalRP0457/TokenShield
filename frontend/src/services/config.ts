/**
 * Runtime configuration, read once from Vite env vars (see .env.example).
 * Vite only exposes variables prefixed with VITE_ to browser code.
 */
const env = import.meta.env;

export const config = {
  /** Use the in-browser mock backend instead of the real FastAPI server. */
  useMock: (env.VITE_USE_MOCK ?? 'true').toLowerCase() !== 'false',
  apiBaseUrl: (env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, ''),
  /** Empty string = no WebSocket; the live feed falls back to polling. */
  wsUrl: (env.VITE_WS_URL ?? '').trim(),
  pollIntervalMs: Number(env.VITE_POLL_INTERVAL_MS ?? 5000) || 5000,
  requestTimeoutMs: 10_000,
} as const;
