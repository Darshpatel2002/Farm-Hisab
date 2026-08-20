import { useCallback, useEffect, useState } from 'react';
import { getSyncStatus, subscribeSync, type SyncStatus } from '../lib/offline/queue';

/** Remembers the last used farm / crop / category / vendor per form. */
export function useRecent<T extends Record<string, string>>(key: string, initial: T) {
  const storageKey = `farm-hisab-recent-${key}`;
  const [recent, setRecent] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? { ...initial, ...(JSON.parse(raw) as T) } : initial;
    } catch {
      return initial;
    }
  });

  const remember = useCallback(
    (values: Partial<T>) => {
      setRecent((current) => {
        const next = { ...current, ...values } as T;
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Storage can be full or disabled - remembering is a nicety, not a requirement.
        }
        return next;
      });
    },
    [storageKey],
  );

  return { recent, remember };
}

/** Report filters persisted locally so they survive a reload. */
export function usePersistedFilters<T>(key: string, initial: T) {
  const storageKey = `farm-hisab-filters-${key}`;
  const [filters, setFilters] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? { ...initial, ...(JSON.parse(raw) as T) } : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch {
      // ignore storage failures
    }
  }, [storageKey, filters]);

  const reset = useCallback(() => setFilters(initial), [initial]);
  return { filters, setFilters, reset };
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  useEffect(() => subscribeSync(setStatus), []);
  return status;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
