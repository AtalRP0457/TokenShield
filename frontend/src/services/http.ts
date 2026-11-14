import { config } from './config';

/** Error thrown for any failed request, so the UI can show a useful message. */
export class ApiError extends Error {
  readonly status: number | null;
  readonly path: string;

  constructor(message: string, path: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.path = path;
    this.status = status;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Thin wrapper around fetch():
 *  - prefixes the configured base URL
 *  - JSON-encodes bodies / decodes responses
 *  - aborts after a timeout so a dead backend can't hang the UI
 *  - turns non-2xx responses into ApiError (FastAPI puts the reason in `detail`)
 */
export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), config.requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const reason =
      err instanceof DOMException && err.name === 'AbortError'
        ? `Request timed out after ${config.requestTimeoutMs / 1000}s`
        : `Cannot reach the TokenShield API at ${config.apiBaseUrl}`;
    throw new ApiError(reason, path);
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data.detail === 'string') detail = data.detail;
    } catch {
      /* body was not JSON — keep statusText */
    }
    throw new ApiError(`${response.status} ${detail}`.trim(), path, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
