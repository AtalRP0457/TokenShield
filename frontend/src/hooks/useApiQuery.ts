import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  /** Re-fetch in the background every N ms (keeps showing old data meanwhile). */
  refreshMs?: number;
}

export interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  /** True only for the first load (no data yet) — drives skeletons. */
  loading: boolean;
  /** True while any request is in flight, including background refreshes. */
  fetching: boolean;
  refetch: () => Promise<void>;
  /** Replace data locally, e.g. after a successful PATCH (optimistic update). */
  setData: (updater: (prev: T | undefined) => T | undefined) => void;
}

/**
 * Small data-fetching hook (a deliberately tiny stand-in for React Query).
 *
 * Why the request counter: if deps change while a request is in flight, the
 * older response could arrive last and overwrite newer data. Each request gets
 * an id and only the latest one is allowed to commit state.
 */
export function useApiQuery<T>(fetcher: () => Promise<T>, deps: unknown[], options: Options = {}): QueryState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [fetching, setFetching] = useState(true);
  const latestRequest = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setFetching(true);
    try {
      const result = await fetcherRef.current();
      if (requestId !== latestRequest.current) return;
      setDataState(result);
      setError(null);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (requestId === latestRequest.current) setFetching(false);
    }
  }, []);

  // Reset and load whenever deps change (e.g. navigating to another agent).
  useEffect(() => {
    setDataState(undefined);
    setError(null);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!options.refreshMs) return;
    const id = window.setInterval(() => void run(), options.refreshMs);
    return () => window.clearInterval(id);
  }, [options.refreshMs, run]);

  const setData = useCallback((updater: (prev: T | undefined) => T | undefined) => {
    setDataState((prev) => updater(prev));
  }, []);

  return { data, error, loading: data === undefined && error === null, fetching, refetch: run, setData };
}
