import { describe, expect, it } from 'vitest';
import { configureFormatting, formatCurrency, formatNumber, parseNumberInput, round, safeDivide, safeNumber } from './number';
import { addDays, compareDates, formatDate, isValidISODate, monthKey } from './date';

configureFormatting({ currency: 'INR', locale: 'en-IN' });

describe('safe arithmetic', () => {
  it('never returns NaN or Infinity', () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(0, 0)).toBe(0);
    expect(safeNumber('abc')).toBe(0);
    expect(safeNumber(Number.POSITIVE_INFINITY)).toBe(0);
    expect(round(Number.NaN)).toBe(0);
  });

  it('rounds to the requested precision', () => {
    expect(round(1234.5678, 2)).toBe(1234.57);
    expect(round(0.005, 2)).toBe(0.01);
  });
});

describe('Indian currency formatting', () => {
  it('groups with the lakh convention', () => {
    expect(formatCurrency(125000)).toContain('1,25,000');
    expect(formatCurrency(12500)).toContain('12,500');
    expect(formatCurrency(1200)).toContain('1,200');
  });

  it('uses a compact lakh form for large numbers', () => {
    expect(formatCurrency(1500000, { compact: true })).toContain('15 L');
    expect(formatCurrency(25000000, { compact: true })).toContain('2.5 Cr');
  });

  it('formats plain numbers', () => {
    expect(formatNumber(1234.567, 2)).toBe('1,234.57');
  });

  it('parses grouped user input', () => {
    expect(parseNumberInput('1,25,000')).toBe(125000);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
  });
});

describe('dates', () => {
  it('shows DD/MM/YYYY', () => {
    expect(formatDate('2026-06-25')).toBe('25/06/2026');
    expect(formatDate(null)).toBe('-');
  });

  it('validates ISO dates', () => {
    expect(isValidISODate('2026-06-25')).toBe(true);
    expect(isValidISODate('25/06/2026')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });

  it('buckets by month and compares safely', () => {
    expect(monthKey('2026-06-25')).toBe('2026-06');
    expect(compareDates('2026-06-01', '2026-07-01')).toBe(-1);
    expect(compareDates(null, '2026-07-01')).toBe(1);
    expect(addDays('2026-06-25', 10)).toBe('2026-07-05');
  });
});
