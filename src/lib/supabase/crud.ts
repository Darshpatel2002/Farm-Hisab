import { supabase } from './client';
import { toAppError, AppError } from '../errors';
import { enqueue } from '../offline/queue';
import type { TableName, Tables, UUID } from '../../types/db';

/**
 * Thin, typed wrapper around Supabase queries.
 *
 * Every write goes through here so that offline queueing, soft delete and
 * error normalisation behave the same way across all features.
 */

type Row<T extends TableName> = Tables[T];

/** Tables whose primary key is not called "id". */
const PRIMARY_KEYS: Partial<Record<TableName, string>> = {
  household_settings: 'household_id',
};

export function primaryKeyOf(table: TableName): string {
  return PRIMARY_KEYS[table] ?? 'id';
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export interface ListOptions {
  /** Equality filters, `null` values are matched with `is null`. */
  match?: Record<string, string | number | boolean | null | undefined>;
  /** Filter rows whose column is contained in the given list. */
  in?: Record<string, ReadonlyArray<string | number>>;
  orderBy?: { column: string; ascending?: boolean };
  dateRange?: { column: string; from?: string | null; to?: string | null };
  search?: { columns: string[]; term: string };
  limit?: number;
  offset?: number;
  /** Include rows with `deleted_at` set. Defaults to false. */
  includeDeleted?: boolean;
}

export async function listRows<T extends TableName>(table: T, options: ListOptions = {}): Promise<Row<T>[]> {
  try {
    let query = supabase.from(table).select('*');

    if (!options.includeDeleted) query = query.is('deleted_at', null);

    for (const [column, value] of Object.entries(options.match ?? {})) {
      if (value === undefined) continue;
      query = value === null ? query.is(column, null) : query.eq(column, value);
    }
    for (const [column, values] of Object.entries(options.in ?? {})) {
      query = query.in(column, values as (string | number)[]);
    }
    if (options.dateRange) {
      const { column, from, to } = options.dateRange;
      if (from) query = query.gte(column, from);
      if (to) query = query.lte(column, to);
    }
    if (options.search && options.search.term.trim()) {
      const term = options.search.term.replace(/[%,()]/g, ' ').trim();
      query = query.or(options.search.columns.map((c) => `${c}.ilike.%${term}%`).join(','));
    }
    if (options.orderBy) {
      query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
    }
    if (options.limit !== undefined) {
      const from = options.offset ?? 0;
      query = query.range(from, from + options.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Row<T>[];
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getRow<T extends TableName>(table: T, id: UUID): Promise<Row<T> | null> {
  try {
    const { data, error } = await supabase.from(table).select('*').eq(primaryKeyOf(table), id).maybeSingle();
    if (error) throw error;
    return (data ?? null) as Row<T> | null;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function countRows<T extends TableName>(table: T, match: Record<string, string> = {}): Promise<number> {
  try {
    let query = supabase.from(table).select('id', { count: 'exact', head: true }).is('deleted_at', null);
    for (const [column, value] of Object.entries(match)) query = query.eq(column, value);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Inserts a row. When the device is offline the row is queued locally and an
 * optimistic copy (with a client-generated id) is returned.
 */
export async function insertRow<T extends TableName>(table: T, values: Record<string, unknown>): Promise<Row<T>> {
  const payload = primaryKeyOf(table) === 'id' ? { id: crypto.randomUUID(), ...values } : { ...values };
  if (isOffline()) {
    await enqueue({ table, op: 'insert', payload });
    return payload as Row<T>;
  }
  try {
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) throw error;
    return data as Row<T>;
  } catch (error) {
    const appError = toAppError(error);
    if (appError.kind === 'network') {
      await enqueue({ table, op: 'insert', payload });
      return payload as Row<T>;
    }
    throw appError;
  }
}

export async function updateRow<T extends TableName>(
  table: T,
  id: UUID,
  values: Record<string, unknown>,
  baseUpdatedAt?: string | null,
): Promise<Row<T>> {
  if (isOffline()) {
    await enqueue({ table, op: 'update', payload: values, rowId: id, baseUpdatedAt });
    return { id, ...values } as Row<T>;
  }
  try {
    const { data, error } = await supabase.from(table).update(values).eq(primaryKeyOf(table), id).select().single();
    if (error) throw error;
    return data as Row<T>;
  } catch (error) {
    const appError = toAppError(error);
    if (appError.kind === 'network') {
      await enqueue({ table, op: 'update', payload: values, rowId: id, baseUpdatedAt });
      return { id, ...values } as Row<T>;
    }
    throw appError;
  }
}

/** Financial records are never destroyed - they are marked as deleted. */
export async function softDeleteRow<T extends TableName>(table: T, id: UUID): Promise<void> {
  const values = { deleted_at: new Date().toISOString() };
  if (isOffline()) {
    await enqueue({ table, op: 'delete', payload: values, rowId: id });
    return;
  }
  try {
    const { error } = await supabase.from(table).update(values).eq(primaryKeyOf(table), id);
    if (error) throw error;
  } catch (error) {
    const appError = toAppError(error);
    if (appError.kind === 'network') {
      await enqueue({ table, op: 'delete', payload: values, rowId: id });
      return;
    }
    throw appError;
  }
}

export async function hardDeleteRow<T extends TableName>(table: T, id: UUID): Promise<void> {
  try {
    const { error } = await supabase.from(table).delete().eq(primaryKeyOf(table), id);
    if (error) throw error;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function callRpc<TResult = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<TResult> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw error;
    return data as TResult;
  } catch (error) {
    throw toAppError(error);
  }
}

export { AppError };
