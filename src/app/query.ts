import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useApi } from './ApiContext';
import type { CoreApi } from '@/api';
import { CoreApiError, toApiError } from '@/api';

/**
 * Tiny query cache (stale-while-revalidate) — enough for a control panel without pulling a data library.
 * Keys are strings; invalidation is prefix-based so "plugins" refreshes "plugins/…" as well.
 */
interface Entry<T = unknown> {
  v?: number;
  data?: T;
  error?: CoreApiError;
  updatedAt: number;
  promise?: Promise<void>;
  fetcher?: () => Promise<T>;
}

class QueryClient {
  private entries = new Map<string, Entry>();
  private subs = new Map<string, Set<() => void>>();

  get<T>(key: string) {
    return this.entries.get(key) as Entry<T> | undefined;
  }
  subscribe(key: string, cb: () => void) {
    let s = this.subs.get(key);
    if (!s) this.subs.set(key, (s = new Set()));
    s.add(cb);
    return () => {
      s!.delete(cb);
    };
  }
  private notify(key: string) {
    const e = this.entries.get(key);
    if (e) e.v = (e.v ?? 0) + 1;
    this.subs.get(key)?.forEach((cb) => cb());
  }

  fetch<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<void> {
    const e = (this.entries.get(key) as Entry<T>) ?? { updatedAt: 0 };
    e.fetcher = fetcher;
    if (e.promise && !force) return e.promise;
    const p = fetcher()
      .then(
        (data) => {
          e.data = data;
          e.error = undefined;
          e.updatedAt = Date.now();
        },
        (err) => {
          e.error = toApiError(err);
          e.updatedAt = Date.now();
        },
      )
      .finally(() => {
        e.promise = undefined;
        this.notify(key);
      });
    e.promise = p;
    this.entries.set(key, e as Entry);
    this.notify(key);
    return p;
  }
  setData<T>(key: string, updater: (prev: T | undefined) => T) {
    const e = (this.entries.get(key) as Entry<T>) ?? { updatedAt: Date.now() };
    e.data = updater(e.data);
    this.entries.set(key, e as Entry);
    this.notify(key);
  }
  invalidate(prefix: string) {
    for (const [k, e] of this.entries)
      if (k === prefix || k.startsWith(prefix + '/')) {
        if (e.fetcher) this.fetch(k, e.fetcher, true);
      }
  }
  /** Refresh matching views without duplicating requests already in flight. */
  refetchPrefix(prefix: string): Promise<void[]> {
    const jobs: Promise<void>[] = [];
    for (const [key, entry] of this.entries)
      if ((key === prefix || key.startsWith(prefix + '/')) && entry.fetcher)
        jobs.push(this.fetch(key, entry.fetcher));
    return Promise.all(jobs);
  }
  clear() {
    this.entries.clear();
  }
}

export const queryClient = new QueryClient();

export interface QueryState<T> {
  data?: T;
  error?: CoreApiError;
  loading: boolean;
  fetching: boolean;
  updatedAt: number;
  refetch: () => void;
}

export function useQuery<T>(
  key: string | null,
  fn: (api: CoreApi) => Promise<T>,
  opts: { refetchMs?: number } = {},
): QueryState<T> {
  const api = useApi();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const fetcher = useCallback(() => fnRef.current(api), [api]);
  const subscribe = useCallback(
    (cb: () => void) => (key ? queryClient.subscribe(key, cb) : () => {}),
    [key],
  );
  useSyncExternalStore(subscribe, () => (key ? (queryClient.get<T>(key)?.v ?? -1) : -1));
  const [, force] = useState(0);

  useEffect(() => {
    if (!key) return;
    const e = queryClient.get<T>(key);
    if (!e || (!e.promise && Date.now() - e.updatedAt > 2000) || e.error)
      queryClient.fetch(key, fetcher);
    else if (e) e.fetcher = fetcher;
    force((x) => x + 1);
  }, [key, fetcher]);

  useEffect(() => {
    if (!key || !opts.refetchMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') queryClient.fetch(key, fetcher);
    }, opts.refetchMs);
    return () => clearInterval(id);
  }, [key, fetcher, opts.refetchMs]);

  const e = key ? queryClient.get<T>(key) : undefined;
  return {
    data: e?.data,
    error: e?.error,
    updatedAt: e?.updatedAt ?? 0,
    loading: !!key && e?.data === undefined && !e?.error,
    fetching: !!e?.promise,
    refetch: () => {
      if (key) queryClient.fetch(key, fetcher, true);
    },
  };
}

export interface MutationState<A extends unknown[], R> {
  run: (...args: A) => Promise<R | undefined>;
  pending: boolean;
  error?: CoreApiError;
  reset: () => void;
}

export function useMutation<A extends unknown[], R>(
  fn: (api: CoreApi, ...args: A) => Promise<R>,
  opts: {
    invalidate?: string[];
    onSuccess?: NoInfer<(r: R, ...args: A) => void>;
    onError?: (e: CoreApiError) => void;
  } = {},
): MutationState<A, R> {
  const api = useApi();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<CoreApiError>();
  const run = async (...args: A) => {
    setPending(true);
    setError(undefined);
    try {
      const r = await fn(api, ...args);
      opts.invalidate?.forEach((k) => queryClient.invalidate(k));
      opts.onSuccess?.(r, ...args);
      return r;
    } catch (e) {
      const err = toApiError(e);
      setError(err);
      opts.onError?.(err);
      return undefined;
    } finally {
      setPending(false);
    }
  };
  return { run, pending, error, reset: () => setError(undefined) };
}
