/**
 * Centralised error handling.
 *
 * Raw PostgREST/Postgres messages are never shown to the user - they are
 * mapped to a translation key and the technical detail is logged instead.
 */

export type ErrorKind =
  | 'network'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'conflict'
  | 'notFound'
  | 'unknown';

export class AppError extends Error {
  readonly kind: ErrorKind;
  /** i18n key under `errors.*`. */
  readonly messageKey: string;
  readonly detail: string | undefined;

  constructor(kind: ErrorKind, messageKey: string, detail?: string) {
    super(messageKey);
    this.name = 'AppError';
    this.kind = kind;
    this.messageKey = messageKey;
    this.detail = detail;
  }
}

interface PostgrestLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
}

function asPostgrest(error: unknown): PostgrestLike | null {
  if (typeof error === 'object' && error !== null) return error as PostgrestLike;
  return null;
}

/** Maps any thrown value to a safe, translatable AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new AppError('network', 'errors.offline');
  }

  const e = asPostgrest(error);
  const raw = e?.message ?? String(error);
  const code = e?.code ?? '';

  if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('fetch failed')) {
    return new AppError('network', 'errors.network', raw);
  }
  if (e?.status === 401 || raw.toLowerCase().includes('jwt') || raw.includes('Invalid login credentials')) {
    return new AppError('auth', 'errors.auth', raw);
  }
  if (code === '42501' || raw.includes('row-level security') || e?.status === 403) {
    return new AppError('permission', 'errors.permission', raw);
  }
  if (code === '23505') return new AppError('conflict', 'errors.duplicate', raw);
  if (code === '23503') return new AppError('validation', 'errors.relatedRecordMissing', raw);
  if (code === '23514' || code === 'P0001') return new AppError('validation', 'errors.validation', raw);
  if (e?.status === 404) return new AppError('notFound', 'errors.notFound', raw);

  return new AppError('unknown', 'errors.unknown', raw);
}

/** Logs technical detail for debugging without surfacing it to the user. */
export function logError(context: string, error: unknown): void {
  const appError = toAppError(error);
  console.error(`[farm-hisab] ${context}: ${appError.messageKey}`, appError.detail ?? error);
}
