/**
 * Date helpers.
 *
 * The database stores real `date` / `timestamptz` values. The UI always shows
 * DD/MM/YYYY and treats "today" in Asia/Kolkata so that a late-evening entry
 * is not filed under the next day.
 */

const TIMEZONE = 'Asia/Kolkata';

/** Today's date in the farm's timezone as `YYYY-MM-DD`. */
export function today(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '01';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidISODate(value: string | null | undefined): boolean {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

/** Formats an ISO date (or timestamp) as DD/MM/YYYY. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const iso = value.length > 10 ? value : `${value}T00:00:00Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: value.length > 10 ? TIMEZONE : 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** Short label used on timelines, e.g. "25 May". */
export function formatDayMonth(value: string | null | undefined, locale = 'en-GB'): string {
  if (!value) return '-';
  const d = new Date(value.length > 10 ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(d);
}

/** `YYYY-MM` bucket used by the cash-flow report. */
export function monthKey(value: string): string {
  return value.slice(0, 7);
}

export function formatMonthLabel(key: string, locale = 'en-GB'): string {
  const [year, month] = key.split('-');
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  if (Number.isNaN(d.getTime())) return key;
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short', year: '2-digit' }).format(d);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function compareDates(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}
