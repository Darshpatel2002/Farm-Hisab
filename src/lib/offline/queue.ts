import { get, set } from 'idb-keyval';
import { supabase } from '../supabase/client';
import { logError } from '../errors';
import type { TableName } from '../../types/db';

/**
 * Offline write queue.
 *
 * When the device is offline (or a write fails because of the network) the
 * mutation is stored in IndexedDB and replayed once connectivity returns.
 * Nothing is ever dropped silently: failed items stay in the queue and are
 * reported to the user.
 */

const QUEUE_KEY = 'farm-hisab-pending-mutations';

export type QueueOp = 'insert' | 'update' | 'delete';

export interface PendingMutation {
  id: string;
  table: TableName;
  op: QueueOp;
  /** Row values for insert/update, ignored for delete. */
  payload: Record<string, unknown>;
  /** Primary key for update/delete. */
  rowId?: string;
  /** `updated_at` of the row when the edit was made, used for conflict detection. */
  baseUpdatedAt?: string | null;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

export type SyncState = 'idle' | 'offline' | 'syncing' | 'synced' | 'error';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  conflicts: number;
  lastSyncedAt: string | null;
}

let status: SyncStatus = {
  state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle',
  pending: 0,
  conflicts: 0,
  lastSyncedAt: null,
};

const listeners = new Set<(s: SyncStatus) => void>();

function emit(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

export function subscribeSync(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export async function readQueue(): Promise<PendingMutation[]> {
  return (await get<PendingMutation[]>(QUEUE_KEY)) ?? [];
}

async function writeQueue(items: PendingMutation[]): Promise<void> {
  await set(QUEUE_KEY, items);
  emit({ pending: items.length });
}

export async function enqueue(mutation: Omit<PendingMutation, 'id' | 'queuedAt' | 'attempts'>): Promise<PendingMutation> {
  const item: PendingMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
  emit({ state: 'offline' });
  return item;
}

/** True when a row on the server has been changed after our local edit. */
async function serverIsNewer(item: PendingMutation): Promise<boolean> {
  if (!item.rowId || !item.baseUpdatedAt) return false;
  const { data } = await supabase.from(item.table).select('updated_at').eq('id', item.rowId).maybeSingle();
  const serverUpdatedAt = (data as { updated_at?: string } | null)?.updated_at;
  if (!serverUpdatedAt) return false;
  return new Date(serverUpdatedAt).getTime() > new Date(item.baseUpdatedAt).getTime();
}

async function applyMutation(item: PendingMutation): Promise<void> {
  if (item.op === 'insert') {
    const { error } = await supabase.from(item.table).insert(item.payload);
    if (error) throw error;
    return;
  }
  if (!item.rowId) throw new Error('Missing row id for queued mutation');

  if (await serverIsNewer(item)) {
    // Never blindly overwrite newer server data - surface it as a conflict.
    emit({ conflicts: status.conflicts + 1 });
    return;
  }

  if (item.op === 'update') {
    const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.rowId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from(item.table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', item.rowId);
  if (error) throw error;
}

let flushing = false;

/** Replays every queued mutation. Safe to call repeatedly. */
export async function flushQueue(): Promise<SyncStatus> {
  if (flushing) return status;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    emit({ state: 'offline' });
    return status;
  }

  const queue = await readQueue();
  if (queue.length === 0) {
    emit({ state: 'idle' });
    return status;
  }

  flushing = true;
  emit({ state: 'syncing' });
  const remaining: PendingMutation[] = [];

  for (const item of queue) {
    try {
      await applyMutation(item);
    } catch (error) {
      logError(`sync ${item.table}.${item.op}`, error);
      remaining.push({ ...item, attempts: item.attempts + 1, lastError: String(error) });
    }
  }

  await writeQueue(remaining);
  flushing = false;
  emit({
    state: remaining.length > 0 ? 'error' : 'synced',
    lastSyncedAt: new Date().toISOString(),
  });
  return status;
}

/** Drops queued items - only used from Settings after the user confirms. */
export async function clearQueue(): Promise<void> {
  await writeQueue([]);
  emit({ state: 'idle', conflicts: 0 });
}

export function startSyncWatcher(onFlushed?: () => void): () => void {
  const goOnline = () => {
    void flushQueue().then(() => onFlushed?.());
  };
  const goOffline = () => emit({ state: 'offline' });

  window.addEventListener('online', goOnline);
  window.addEventListener('offline', goOffline);
  void readQueue().then((q) => emit({ pending: q.length }));
  if (navigator.onLine) goOnline();

  return () => {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
  };
}
