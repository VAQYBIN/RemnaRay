'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@remnaray/domain';

/** Section 13.4: reads are cached for 15 seconds; mutations invalidate instead. */
export const STALE_TIME_MS = 15_000;

export type Resource<T> =
  | { status: 'loading' }
  | { status: 'error'; code: string; requestId?: string }
  | { status: 'ready'; data: T };

type Entry = { at: number; data: unknown };

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

export function invalidate(prefix = ''): void {
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
  for (const [key, group] of listeners)
    if (key.startsWith(prefix)) for (const listener of group) listener();
}

function subscribe(key: string, listener: () => void): () => void {
  const group = listeners.get(key) ?? new Set<() => void>();
  group.add(listener);
  listeners.set(key, group);
  return () => {
    group.delete(listener);
    if (group.size === 0) listeners.delete(key);
  };
}

export function toResourceError(error: unknown): {
  status: 'error';
  code: string;
  requestId?: string;
} {
  if (error instanceof ApiError)
    return {
      status: 'error',
      code: error.code,
      ...(error.requestId ? { requestId: error.requestId } : {}),
    };
  return { status: 'error', code: 'INTERNAL_ERROR' };
}

/**
 * Minimal `useQuery`-shaped hook: one in-flight request per key, a 15 second
 * stale window, and an explicit `refresh` for the retry button.
 */
export function useResource<T>(
  key: string,
  loader: () => Promise<T>,
): { state: Resource<T>; refresh: () => void } {
  const [state, setState] = useState<Resource<T>>(() => {
    const cached = cache.get(key);
    return cached && Date.now() - cached.at < STALE_TIME_MS
      ? { status: 'ready', data: cached.data as T }
      : { status: 'loading' };
  });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(
    (force: boolean) => {
      const cached = cache.get(key);
      if (!force && cached && Date.now() - cached.at < STALE_TIME_MS) {
        setState({ status: 'ready', data: cached.data as T });
        return () => undefined;
      }
      let active = true;
      setState({ status: 'loading' });
      loaderRef.current().then(
        (data) => {
          cache.set(key, { at: Date.now(), data });
          if (active) setState({ status: 'ready', data });
        },
        (error: unknown) => {
          if (active) setState(toResourceError(error));
        },
      );
      return () => {
        active = false;
      };
    },
    [key],
  );

  useEffect(() => {
    const stop = run(false);
    const unsubscribe = subscribe(key, () => {
      run(true);
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, [key, run]);

  return {
    state,
    refresh: useCallback(() => {
      cache.delete(key);
      run(true);
    }, [key, run]),
  };
}
