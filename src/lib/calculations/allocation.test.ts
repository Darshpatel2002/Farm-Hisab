import { describe, expect, it } from 'vitest';
import { allocateExpense, allocationSum, isFullyAllocated, ratePerAcre, unallocatedAmount } from './allocation';

describe('allocateExpense', () => {
  const targets = [
    { farmId: 'f1', acres: 2 },
    { farmId: 'f2', acres: 3 },
  ];

  it('splits equally', () => {
    const lines = allocateExpense(1000, targets, 'equal');
    expect(lines.map((l) => l.amount)).toEqual([500, 500]);
    expect(allocationSum(lines)).toBe(1000);
  });

  it('splits by area', () => {
    const lines = allocateExpense(1000, targets, 'area');
    expect(lines[0].amount).toBe(400);
    expect(lines[1].amount).toBe(600);
  });

  it('splits the specification example of 10,000 across 5 acres', () => {
    const fiveFarms = [
      { farmId: 'a', acres: 1 },
      { farmId: 'b', acres: 1 },
      { farmId: 'c', acres: 1 },
      { farmId: 'd', acres: 1 },
      { farmId: 'e', acres: 1 },
    ];
    expect(ratePerAcre(10000, fiveFarms)).toBe(2000);
    const lines = allocateExpense(10000, fiveFarms, 'area');
    expect(lines.every((line) => line.amount === 2000)).toBe(true);
    expect(allocationSum(lines)).toBe(10000);
  });

  it('keeps the manual amounts entered by the user', () => {
    const lines = allocateExpense(10000, [
      { farmId: 'f1', amount: 4000 },
      { farmId: 'f2', amount: 6000 },
    ], 'manual');
    expect(allocationSum(lines)).toBe(10000);
    expect(isFullyAllocated(10000, lines)).toBe(true);
  });

  it('puts rounding remainders on the last line so the split is exact', () => {
    const lines = allocateExpense(100, [
      { farmId: 'f1', acres: 1 },
      { farmId: 'f2', acres: 1 },
      { farmId: 'f3', acres: 1 },
    ], 'area');
    expect(allocationSum(lines)).toBe(100);
  });

  it('falls back to an equal split when every area is zero', () => {
    const lines = allocateExpense(300, [
      { farmId: 'f1', acres: 0 },
      { farmId: 'f2', acres: 0 },
    ], 'area');
    expect(lines.map((l) => l.amount)).toEqual([150, 150]);
  });

  it('returns nothing for an empty or zero expense', () => {
    expect(allocateExpense(0, targets, 'equal')).toEqual([]);
    expect(allocateExpense(1000, [], 'equal')).toEqual([]);
  });

  it('reports the unallocated remainder', () => {
    const lines = allocateExpense(10000, [{ farmId: 'f1', amount: 4000 }], 'manual');
    expect(unallocatedAmount(10000, lines)).toBe(6000);
    expect(isFullyAllocated(10000, lines)).toBe(false);
  });

  it('never divides by zero', () => {
    expect(ratePerAcre(1000, [])).toBe(0);
    expect(Number.isFinite(ratePerAcre(1000, [{ farmId: 'f1', acres: 0 }]))).toBe(true);
  });
});
