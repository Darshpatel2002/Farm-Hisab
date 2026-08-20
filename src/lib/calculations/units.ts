import { safeNumber, round } from '../formatting/number';
import type { Unit, UnitKind } from '../../types/db';

/**
 * Unit conversion.
 *
 * Nothing about "1 vigha = X acre" is hard-coded: every household stores its
 * own `factor_to_base` per unit and can edit it in Settings.
 * Base units are acre (area), kg (weight), litre (volume) and hour (time).
 */

export type UnitMap = Record<string, Unit>;

export function indexUnits(units: Unit[]): UnitMap {
  const map: UnitMap = {};
  for (const unit of units) map[`${unit.kind}:${unit.code}`] = unit;
  return map;
}

export function unitFactor(units: UnitMap, kind: UnitKind, code: string | null | undefined): number {
  if (!code) return 1;
  const factor = units[`${kind}:${code}`]?.factor_to_base;
  return factor && factor > 0 ? factor : 1;
}

/** Converts a value in `code` into the base unit for its kind. */
export function toBaseUnit(units: UnitMap, kind: UnitKind, value: number, code: string | null | undefined): number {
  return round(safeNumber(value) * unitFactor(units, kind, code), 4);
}

/** Converts a base-unit value back into `code`. */
export function fromBaseUnit(units: UnitMap, kind: UnitKind, baseValue: number, code: string | null | undefined): number {
  const factor = unitFactor(units, kind, code);
  return factor === 0 ? 0 : round(safeNumber(baseValue) / factor, 4);
}

/** Area in acres, used everywhere "per acre" numbers are calculated. */
export function toAcres(units: UnitMap, area: number, areaUnit: string | null | undefined): number {
  return toBaseUnit(units, 'area', area, areaUnit);
}

/** Weight in quintal, the unit farmers use for yield. */
export function toQuintal(units: UnitMap, quantity: number, unit: string | null | undefined): number {
  const kg = toBaseUnit(units, 'weight', quantity, unit);
  const quintalFactor = unitFactor(units, 'weight', 'quintal') || 100;
  return round(kg / quintalFactor, 4);
}

export function unitLabel(units: UnitMap, kind: UnitKind, code: string | null | undefined, language: string): string {
  if (!code) return '';
  const unit = units[`${kind}:${code}`];
  if (!unit) return code;
  return language === 'gu' && unit.label_gu ? unit.label_gu : unit.label_en;
}

export function unitsOfKind(units: Unit[], kind: UnitKind): Unit[] {
  return units.filter((u) => u.kind === kind && u.is_active).sort((a, b) => a.sort_order - b.sort_order);
}
