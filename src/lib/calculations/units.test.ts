import { describe, expect, it } from 'vitest';
import { fromBaseUnit, toAcres, toBaseUnit, toQuintal, unitFactor, unitLabel, unitsOfKind } from './units';
import { TEST_UNITS, unitMap } from '../test-utils/factories';

describe('unit conversion', () => {
  it('uses the household configured factor instead of a hard-coded one', () => {
    expect(unitFactor(unitMap, 'area', 'vigha')).toBe(0.4);
    expect(toAcres(unitMap, 2.5, 'vigha')).toBe(1);
  });

  it('treats an unknown unit as 1:1 rather than failing', () => {
    expect(toAcres(unitMap, 3, 'unknown-unit')).toBe(3);
    expect(toAcres(unitMap, 3, null)).toBe(3);
  });

  it('converts weight to quintal', () => {
    expect(toQuintal(unitMap, 250, 'kg')).toBe(2.5);
    expect(toQuintal(unitMap, 3, 'quintal')).toBe(3);
  });

  it('round-trips between base and display units', () => {
    const acres = toBaseUnit(unitMap, 'area', 5, 'vigha');
    expect(fromBaseUnit(unitMap, 'area', acres, 'vigha')).toBe(5);
  });

  it('picks the label for the active language', () => {
    expect(unitLabel(unitMap, 'area', 'acre', 'en')).toBe('Acre');
    expect(unitLabel(unitMap, 'area', 'missing', 'en')).toBe('missing');
  });

  it('lists active units of one kind in order', () => {
    expect(unitsOfKind(TEST_UNITS, 'area').map((u) => u.code)).toEqual(['acre', 'vigha']);
  });
});
