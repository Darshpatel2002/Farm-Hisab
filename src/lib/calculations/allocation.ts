import { round, safeDivide, safeNumber } from '../formatting/number';

/**
 * Shared expense allocation.
 *
 * A shared expense (for example one tractor bill covering five farms) is
 * stored once in `expenses`. These helpers only decide HOW that single amount
 * is distributed - they never create additional money. The distributed parts
 * always add up to exactly the original amount.
 */

export type AllocationBasis = 'manual' | 'area' | 'equal';

export interface AllocationTarget {
  farmId: string;
  allocationId?: string | null;
  /** Area in acres, required for the "by area" basis. */
  acres?: number;
  /** Explicit amount, required for the "manual" basis. */
  amount?: number;
}

export interface AllocationLine {
  farmId: string;
  allocationId: string | null;
  amount: number;
  basis: AllocationBasis;
}

/**
 * Distributes `total` across `targets`.
 * Rounding remainders are pushed onto the last line so the sum is exact.
 */
export function allocateExpense(total: number, targets: AllocationTarget[], basis: AllocationBasis): AllocationLine[] {
  const amount = round(safeNumber(total), 2);
  if (targets.length === 0 || amount <= 0) return [];

  if (basis === 'manual') {
    return targets.map((t) => ({
      farmId: t.farmId,
      allocationId: t.allocationId ?? null,
      amount: round(safeNumber(t.amount), 2),
      basis,
    }));
  }

  const weights = targets.map((t) => (basis === 'area' ? Math.max(safeNumber(t.acres), 0) : 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  // Falling back to an equal split keeps a zero-area farm from breaking the math.
  const effectiveWeights = totalWeight > 0 ? weights : targets.map(() => 1);
  const effectiveTotalWeight = totalWeight > 0 ? totalWeight : targets.length;

  let running = 0;
  return targets.map((t, index) => {
    const isLast = index === targets.length - 1;
    const share = isLast
      ? round(amount - running, 2)
      : round((amount * effectiveWeights[index]) / effectiveTotalWeight, 2);
    running = round(running + share, 2);
    return { farmId: t.farmId, allocationId: t.allocationId ?? null, amount: share, basis };
  });
}

/** Per-acre rate used to explain an area-based split to the user. */
export function ratePerAcre(total: number, targets: AllocationTarget[]): number {
  const acres = targets.reduce((sum, t) => sum + Math.max(safeNumber(t.acres), 0), 0);
  return round(safeDivide(safeNumber(total), acres), 2);
}

export function allocationSum(lines: Array<{ amount: number }>): number {
  return round(lines.reduce((sum, l) => sum + safeNumber(l.amount), 0), 2);
}

/** Amount of a shared expense that has not been assigned to any farm yet. */
export function unallocatedAmount(total: number, lines: Array<{ amount: number }>): number {
  return round(safeNumber(total) - allocationSum(lines), 2);
}

export function isFullyAllocated(total: number, lines: Array<{ amount: number }>, tolerance = 0.01): boolean {
  return Math.abs(unallocatedAmount(total, lines)) <= tolerance;
}
