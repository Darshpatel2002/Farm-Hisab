/**
 * Number, currency and quantity formatting.
 * Indian grouping (1,25,000) and the rupee symbol come from Intl, never from
 * hard-coded strings, so the currency stays configurable in Settings.
 */

let currencyCode = 'INR';
let localeTag = 'en-IN';

export function configureFormatting(options: { currency?: string; locale?: string }): void {
  if (options.currency) currencyCode = options.currency;
  if (options.locale) localeTag = options.locale;
}

/** Guards against NaN / Infinity anywhere in the reporting pipeline. */
export function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Division that returns 0 instead of NaN or Infinity. */
export function safeDivide(numerator: number, denominator: number): number {
  const n = safeNumber(numerator);
  const d = safeNumber(denominator);
  if (d === 0) return 0;
  const result = n / d;
  return Number.isFinite(result) ? result : 0;
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((safeNumber(value) + Number.EPSILON) * factor) / factor;
}

/** The currency symbol on its own, e.g. "₹". */
export function currencySymbol(): string {
  const parts = new Intl.NumberFormat(localeTag, { style: 'currency', currency: currencyCode }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value ?? '';
}

export function formatCurrency(value: unknown, options: { compact?: boolean; decimals?: number } = {}): string {
  const amount = safeNumber(value);
  if (options.compact && Math.abs(amount) >= 100000) {
    // Indian readers understand lakh/crore far better than "100K".
    const symbol = currencySymbol();
    if (Math.abs(amount) >= 10000000) return `${symbol}${formatNumber(amount / 10000000, 2)} Cr`;
    return `${symbol}${formatNumber(amount / 100000, 2)} L`;
  }
  return new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: options.decimals ?? 0,
    maximumFractionDigits: options.decimals ?? 0,
  }).format(amount);
}

export function formatNumber(value: unknown, decimals = 2): string {
  return new Intl.NumberFormat(localeTag, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(safeNumber(value));
}

export function formatPercent(value: unknown, decimals = 0): string {
  return `${formatNumber(safeNumber(value), decimals)}%`;
}

export function formatQuantity(value: unknown, unitLabel: string, decimals = 2): string {
  return `${formatNumber(value, decimals)} ${unitLabel}`.trim();
}

/** Parses user input that may contain grouping separators or a currency symbol. */
export function parseNumberInput(input: string): number | null {
  if (input === null || input === undefined) return null;
  const cleaned = String(input).replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
