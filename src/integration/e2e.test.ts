import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../lib/supabase/client';
import { insertRow, listRows, hardDeleteRow } from '../lib/supabase/crud';
import { buildSeasonReport, type FinancialDataset } from '../lib/calculations/profit';
import { allocateExpense } from '../lib/calculations/allocation';
import { indexUnits, toAcres } from '../lib/calculations/units';
import { analyseBestCrops, cropRankings, farmRankings } from '../lib/calculations/ranking';
import type { Expense, Profile, Unit } from '../types/db';

/**
 * End-to-end check against a real Supabase project.
 *
 * Skipped unless E2E=1, because it needs network access and credentials.
 * It creates a throwaway user, which gets its own isolated household, so it
 * can never touch real farm data. Everything it creates is deleted again.
 *
 *   $env:E2E=1; npx vitest run src/integration/e2e.test.ts
 */

const RUN = process.env.E2E === '1';
const stamp = Date.now();
const userA = { email: `e2e-a-${stamp}@farmhisab.test`, password: `Test-${stamp}!a` };
const userB = { email: `e2e-b-${stamp}@farmhisab.test`, password: `Test-${stamp}!b` };

let householdA = '';
let seasonId = '';
let farmA = '';
let farmB = '';
let cropGroundnut = '';
let cropCotton = '';
let allocA = '';
let allocB = '';
let unitMap: ReturnType<typeof indexUnits> = {};

async function signIn(user: { email: string; password: string }) {
  const { error } = await supabase.auth.signInWithPassword(user);
  if (error) throw error;
}

async function signUp(user: { email: string; password: string }, fullName: string) {
  const { error } = await supabase.auth.signUp({
    email: user.email,
    password: user.password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
}

async function loadDataset(): Promise<FinancialDataset> {
  const match = { season_id: seasonId };
  const [allocations, expenses, harvests, sales, activities, irrigations, sprays, farms, crops, allExpAlloc] =
    await Promise.all([
      listRows('farm_crop_allocations', { match }),
      listRows('expenses', { match }),
      listRows('harvests', { match }),
      listRows('sales', { match }),
      listRows('activities', { match }),
      listRows('irrigation_records', { match }),
      listRows('spray_records', { match }),
      listRows('farms', {}),
      listRows('crops', {}),
      listRows('expense_allocations', { includeDeleted: true }),
    ]);
  const expenseIds = new Set(expenses.map((e) => e.id));
  return {
    units: unitMap,
    farms,
    crops,
    allocations,
    expenses,
    expenseAllocations: allExpAlloc.filter((a) => expenseIds.has(a.expense_id)),
    harvests,
    sales,
    activities,
    irrigations,
    sprays,
  };
}

describe.skipIf(!RUN)('end-to-end against live Supabase', () => {
  beforeAll(async () => {
    await signUp(userA, 'E2E Owner');
    await signIn(userA);
    const profiles = await listRows('profiles', { includeDeleted: true });
    householdA = (profiles[0] as Profile).household_id;

    const units = (await listRows('units', { includeDeleted: true })) as Unit[];
    unitMap = indexUnits(units);
  }, 60_000);

  afterAll(async () => {
    if (!householdA) return;
    await signIn(userA);
    // Deleting the season cascades to every operational and money row.
    for (const id of [seasonId]) if (id) await hardDeleteRow('seasons', id);
    for (const id of [farmA, farmB]) if (id) await hardDeleteRow('farms', id);
    for (const id of [cropGroundnut, cropCotton]) if (id) await hardDeleteRow('crops', id);
    await supabase.auth.signOut();
  }, 60_000);

  it('1. signup created an isolated household with the owner role', async () => {
    const profiles = (await listRows('profiles', { includeDeleted: true })) as Profile[];
    expect(profiles).toHaveLength(1);
    expect(profiles[0].role).toBe('admin');
    expect(householdA).toBeTruthy();
  });

  it('2. seeded the local unit conversion factors', () => {
    expect(unitMap['area:acre'].factor_to_base).toBe(1);
    // 23 guntha = 1 vigha, 40.5 guntha = 1 acre, 100 guntha = 1 hectare
    expect(unitMap['area:vigha'].factor_to_base).toBeCloseTo(23 / 40.5, 6);
    expect(unitMap['area:guntha'].factor_to_base).toBeCloseTo(1 / 40.5, 6);
    expect(unitMap['area:hectare'].factor_to_base).toBeCloseTo(100 / 40.5, 6);
    expect(unitMap['area:vigha'].factor_to_base / unitMap['area:guntha'].factor_to_base).toBeCloseTo(23, 6);
    // 1 Man = 20 kg
    expect(unitMap['weight:man'].factor_to_base).toBe(20);
    expect(unitMap['weight:quintal'].factor_to_base).toBe(100);
  });

  it('3. creates a season, crops and farms with correct acre conversion', async () => {
    const season = await insertRow('seasons', {
      household_id: householdA,
      name: '2026 Kharif E2E',
      year: 2026,
      start_date: '2026-06-01',
      end_date: '2026-11-30',
      status: 'active',
    });
    seasonId = season.id;

    cropGroundnut = (await insertRow('crops', { household_id: householdA, name: 'Groundnut E2E', name_gu: 'મગફળી' })).id;
    cropCotton = (await insertRow('crops', { household_id: householdA, name: 'Cotton E2E', name_gu: 'કપાસ' })).id;

    farmA = (
      await insertRow('farms', {
        household_id: householdA,
        name: 'E2E Farm A',
        area: 2,
        area_unit: 'acre',
        acre_equivalent: toAcres(unitMap, 2, 'acre'),
      })
    ).id;

    const twoVighaInAcres = toAcres(unitMap, 2, 'vigha');
    farmB = (
      await insertRow('farms', {
        household_id: householdA,
        name: 'E2E Farm B',
        area: 2,
        area_unit: 'vigha',
        acre_equivalent: twoVighaInAcres,
      })
    ).id;

    const farms = await listRows('farms', {});
    expect(farms).toHaveLength(2);
    // 2 vigha must normalise to 2 x 23/40.5 acres.
    expect(twoVighaInAcres).toBeCloseTo(1.1358, 4);
  });

  it('4. assigns crops to farms (many crops per farm supported)', async () => {
    allocA = (
      await insertRow('farm_crop_allocations', {
        household_id: householdA,
        farm_id: farmA,
        season_id: seasonId,
        crop_id: cropGroundnut,
        area: 2,
        area_unit: 'acre',
        acre_equivalent: 2,
        sowing_date: '2026-06-10',
        expected_harvest_date: '2026-10-01',
        status: 'growing',
      })
    ).id;

    allocB = (
      await insertRow('farm_crop_allocations', {
        household_id: householdA,
        farm_id: farmB,
        season_id: seasonId,
        crop_id: cropCotton,
        area: 2,
        area_unit: 'vigha',
        acre_equivalent: toAcres(unitMap, 2, 'vigha'),
        sowing_date: '2026-06-12',
        status: 'growing',
      })
    ).id;

    expect(allocA).toBeTruthy();
    expect(allocB).toBeTruthy();
  });

  it('5. records work and mirrors each cost into exactly one expense', async () => {
    await insertRow('irrigation_records', {
      household_id: householdA,
      season_id: seasonId,
      farm_id: farmA,
      allocation_id: allocA,
      date: '2026-07-01',
      water_source: 'borewell',
      hours: 3,
      cost: 300,
    });
    await insertRow('irrigation_records', {
      household_id: householdA,
      season_id: seasonId,
      farm_id: farmA,
      allocation_id: allocA,
      date: '2026-07-20',
      water_source: 'borewell',
      hours: 3,
      cost: 300,
    });
    await insertRow('spray_records', {
      household_id: householdA,
      season_id: seasonId,
      farm_id: farmA,
      allocation_id: allocA,
      crop_id: cropGroundnut,
      scope: 'farm',
      date: '2026-07-10',
      product_name: 'E2E Medicine',
      purpose: 'insecticide',
      quantity: 500,
      unit: 'ml',
      rate: 1,
      material_cost: 500,
      labour_cost: 200,
      application_cost: 0,
    });
    await insertRow('activities', {
      household_id: householdA,
      season_id: seasonId,
      farm_id: farmA,
      allocation_id: allocA,
      date: '2026-06-05',
      activity_type: 'land_preparation',
      description: 'Ploughing',
      cost: 1000,
      tractor_hours: 2,
    });

    const irrigations = await listRows('irrigation_records', { match: { season_id: seasonId } });
    // Numbers are assigned automatically: 1st, 2nd irrigation.
    expect(irrigations.map((i) => i.irrigation_number).sort()).toEqual([1, 2]);

    const sprays = await listRows('spray_records', { match: { season_id: seasonId } });
    expect(sprays[0].spray_number).toBe(1);
    expect(Number(sprays[0].total_cost)).toBe(700);

    const expenses = (await listRows('expenses', { match: { season_id: seasonId } })) as Expense[];
    const bySource = Object.fromEntries(expenses.map((e) => [`${e.source_type}:${e.source_id}`, Number(e.amount)]));
    expect(Object.values(bySource).filter((v) => v === 700)).toHaveLength(1);
    expect(expenses.filter((e) => e.source_type === 'irrigation')).toHaveLength(2);
    expect(expenses.filter((e) => e.source_type === 'activity')).toHaveLength(1);
    // 300 + 300 + 700 + 1000
    expect(expenses.reduce((s, e) => s + Number(e.amount), 0)).toBe(2300);
  });

  it('6. splits a shared expense without double counting', async () => {
    const shared = await insertRow('expenses', {
      household_id: householdA,
      season_id: seasonId,
      date: '2026-06-02',
      category: 'tractor',
      description: 'Shared tractor E2E',
      amount: 10000,
      allocation_method: 'area',
    });

    const acresA = 2;
    const acresB = toAcres(unitMap, 2, 'vigha');
    const lines = allocateExpense(10000, [
      { farmId: farmA, allocationId: allocA, acres: acresA },
      { farmId: farmB, allocationId: allocB, acres: acresB },
    ], 'area');

    for (const line of lines) {
      await insertRow('expense_allocations', {
        household_id: householdA,
        expense_id: shared.id,
        farm_id: line.farmId,
        allocation_id: line.allocationId,
        amount: line.amount,
        basis: 'area',
      });
    }

    const stored = await listRows('expense_allocations', { match: { expense_id: shared.id }, includeDeleted: true });
    const sum = stored.reduce((s, a) => s + Number(a.amount), 0);
    expect(Number(sum.toFixed(2))).toBe(10000);
    expect(stored).toHaveLength(2);
  });

  it('7. rejects an over-allocation (database guard)', async () => {
    const expenses = (await listRows('expenses', { match: { season_id: seasonId } })) as Expense[];
    const shared = expenses.find((e) => e.description === 'Shared tractor E2E');
    await expect(
      insertRow('expense_allocations', {
        household_id: householdA,
        expense_id: shared?.id,
        farm_id: farmA,
        amount: 5000,
        basis: 'manual',
      }),
    ).rejects.toThrow();
  });

  it('8. records seeds, multiple harvests and a sale with deductions', async () => {
    await insertRow('seed_records', {
      household_id: householdA,
      season_id: seasonId,
      farm_id: farmA,
      allocation_id: allocA,
      crop_id: cropGroundnut,
      date: '2026-06-10',
      variety: 'E2E variety',
      quantity: 40,
      unit: 'kg',
      price_per_unit: 100,
    });

    await insertRow('harvests', {
      household_id: householdA,
      season_id: seasonId,
      farm_id: farmA,
      allocation_id: allocA,
      crop_id: cropGroundnut,
      start_date: '2026-10-05',
      quantity: 8,
      unit: 'quintal',
      wastage: 0,
    });
    const second = await insertRow('harvests', {
      household_id: householdA,
      season_id: seasonId,
      farm_id: farmA,
      allocation_id: allocA,
      crop_id: cropGroundnut,
      start_date: '2026-10-12',
      quantity: 3,
      unit: 'quintal',
      wastage: 1,
    });
    // Generated column: 3 harvested - 1 wasted = 2 net
    expect(Number(second.net_quantity)).toBe(2);

    const sale = await insertRow('sales', {
      household_id: householdA,
      season_id: seasonId,
      farm_id: farmA,
      allocation_id: allocA,
      crop_id: cropGroundnut,
      date: '2026-11-01',
      buyer: 'E2E Buyer',
      quantity: 10,
      unit: 'quintal',
      price_per_unit: 5000,
      transport_cost: 1000,
      commission: 500,
      other_deductions: 0,
      payment_status: 'received',
    });
    expect(Number(sale.gross_amount)).toBe(50000);
    // 50000 - 1000 - 500
    expect(Number(sale.net_amount)).toBe(48500);

    const seedExpense = (await listRows('expenses', { match: { season_id: seasonId } })).filter(
      (e) => e.source_type === 'seed',
    );
    expect(Number(seedExpense[0].amount)).toBe(4000);
  });

  it('9. produces a correct season report from the raw rows', async () => {
    const dataset = await loadDataset();
    const report = buildSeasonReport(dataset);

    // 2300 work + 10000 shared + 4000 seed
    expect(report.totals.cost).toBe(16300);
    expect(report.totals.revenue).toBe(48500);
    expect(report.totals.profit).toBe(32200);
    expect(report.totals.yieldQuintal).toBe(10); // 8 + (3-1)
    expect(report.totals.unallocatedCost).toBe(0);

    const a = report.byFarm.find((f) => f.farmId === farmA);
    expect(a?.acres).toBe(2);
    expect(a?.yieldPerAcre).toBe(5);
    expect(a?.revenue).toBe(48500);

    // ROI = profit / cost * 100, and never NaN
    expect(report.totals.roi).toBeCloseTo((32200 / 16300) * 100, 1);
    for (const value of Object.values(report.totals)) expect(Number.isFinite(value)).toBe(true);

    // Farm-level costs come from allocations and must equal the grand total.
    const allocated = report.byFarm.reduce((s, f) => s + f.cost, 0);
    expect(Number(allocated.toFixed(2))).toBe(16300);
  });

  it('10. builds rankings, best-crop analysis and cash flow', async () => {
    const report = buildSeasonReport(await loadDataset());

    expect(farmRankings(report.byFarm).byProfit[0].item.farmId).toBe(farmA);
    expect(cropRankings(report.byCrop).byProfitPerAcre.length).toBeGreaterThan(0);

    const best = analyseBestCrops(report.byCrop);
    expect(best.highestTotalProfit?.name).toContain('Groundnut');
    expect(best.bestValue?.score).toBeGreaterThanOrEqual(0);

    expect(report.monthly.length).toBeGreaterThan(0);
    const lastMonth = report.monthly[report.monthly.length - 1];
    expect(lastMonth.cumulativeReceived).toBe(48500);
    expect(lastMonth.cumulativeSpent).toBe(16300);

    expect(report.byCategory.reduce((s, c) => s + c.amount, 0)).toBe(16300);
  });

  it('11. keeps another household from reading this data (RLS)', async () => {
    await supabase.auth.signOut();
    await signUp(userB, 'E2E Stranger');
    await signIn(userB);

    const farms = await listRows('farms', {});
    const expenses = await listRows('expenses', {});
    const sales = await listRows('sales', {});
    expect(farms).toHaveLength(0);
    expect(expenses).toHaveLength(0);
    expect(sales).toHaveLength(0);

    await supabase.auth.signOut();
    await signIn(userA);
    expect(await listRows('farms', {})).toHaveLength(2);
  }, 60_000);
});
