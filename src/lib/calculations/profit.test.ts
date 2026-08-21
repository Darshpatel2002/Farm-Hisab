import { describe, expect, it } from 'vitest';
import { buildSeasonReport, computeEffortScore, type FinancialDataset } from './profit';
import { applyFilters } from './filters';
import {
  activity,
  allocation,
  crop,
  expense,
  expenseAllocation,
  farm,
  harvest,
  irrigation,
  sale,
  spray,
  unitMap,
} from '../test-utils/factories';

function dataset(overrides: Partial<FinancialDataset> = {}): FinancialDataset {
  return {
    units: unitMap,
    farms: [],
    crops: [],
    allocations: [],
    expenses: [],
    expenseAllocations: [],
    harvests: [],
    sales: [],
    activities: [],
    irrigations: [],
    sprays: [],
    ...overrides,
  };
}

describe('buildSeasonReport - worked example from the specification', () => {
  // Area 2 acres, expense 20,000, harvest 10 quintal sold at 5,000/quintal.
  const data = dataset({
    farms: [farm('f1', 2)],
    crops: [crop('c1', 'Groundnut')],
    allocations: [allocation('a1', 'f1', 'c1', 2)],
    expenses: [expense('e1', 20000, { farm_id: 'f1', allocation_id: 'a1', crop_id: 'c1' })],
    expenseAllocations: [expenseAllocation('ea1', 'e1', 'f1', 20000, 'a1')],
    harvests: [harvest('h1', 'f1', 10, { allocation_id: 'a1', crop_id: 'c1' })],
    sales: [sale('s1', 'f1', 10, 5000, { allocation_id: 'a1', crop_id: 'c1' })],
  });
  const report = buildSeasonReport(data);

  it('calculates revenue, profit and ROI', () => {
    expect(report.totals.revenue).toBe(50000);
    expect(report.totals.cost).toBe(20000);
    expect(report.totals.profit).toBe(30000);
    expect(report.totals.roi).toBe(150);
  });

  it('calculates per acre figures', () => {
    const farmReport = report.byFarm[0];
    expect(farmReport.acres).toBe(2);
    expect(farmReport.profitPerAcre).toBe(15000);
    expect(farmReport.costPerAcre).toBe(10000);
    expect(farmReport.yieldPerAcre).toBe(5);
    expect(farmReport.revenuePerAcre).toBe(25000);
  });

  it('calculates per quintal figures', () => {
    const cropReport = report.byCrop[0];
    expect(cropReport.revenuePerQuintal).toBe(5000);
    expect(cropReport.costPerQuintal).toBe(2000);
    expect(cropReport.profitPerQuintal).toBe(3000);
  });
});

describe('shared expenses are never double counted', () => {
  const data = dataset({
    farms: [farm('f1', 4), farm('f2', 6)],
    crops: [crop('c1')],
    allocations: [allocation('a1', 'f1', 'c1', 4), allocation('a2', 'f2', 'c1', 6)],
    expenses: [expense('e1', 10000, { allocation_method: 'area', category: 'tractor' })],
    expenseAllocations: [
      expenseAllocation('ea1', 'e1', 'f1', 4000, 'a1'),
      expenseAllocation('ea2', 'e1', 'f2', 6000, 'a2'),
    ],
  });
  const report = buildSeasonReport(data);

  it('reports the shared expense once in the grand total', () => {
    expect(report.totals.cost).toBe(10000);
  });

  it('attributes the split amounts to each farm', () => {
    expect(report.byFarm.find((f) => f.farmId === 'f1')?.cost).toBe(4000);
    expect(report.byFarm.find((f) => f.farmId === 'f2')?.cost).toBe(6000);
  });

  it('rolls the split up to the crop without duplication', () => {
    expect(report.byCrop.find((c) => c.cropId === 'c1')?.cost).toBe(10000);
    expect(report.totals.unallocatedCost).toBe(0);
  });
});

describe('expense detail per farm and per crop', () => {
  const data = dataset({
    farms: [farm('f1', 2, 'Farm One'), farm('f2', 3, 'Farm Two')],
    crops: [crop('c1', 'Groundnut'), crop('c2', 'Cotton')],
    allocations: [allocation('a1', 'f1', 'c1', 2), allocation('a2', 'f2', 'c2', 3)],
    expenses: [
      expense('e1', 5000, { farm_id: 'f1', allocation_id: 'a1', category: 'seeds' }),
      expense('e2', 3000, { farm_id: 'f1', allocation_id: 'a1', category: 'labour' }),
      expense('e3', 2000, { farm_id: 'f1', allocation_id: 'a1', category: 'seeds' }),
      expense('e4', 4000, { farm_id: 'f2', allocation_id: 'a2', category: 'irrigation' }),
    ],
    expenseAllocations: [
      expenseAllocation('ea1', 'e1', 'f1', 5000, 'a1'),
      expenseAllocation('ea2', 'e2', 'f1', 3000, 'a1'),
      expenseAllocation('ea3', 'e3', 'f1', 2000, 'a1'),
      expenseAllocation('ea4', 'e4', 'f2', 4000, 'a2'),
    ],
  });
  const report = buildSeasonReport(data);

  it("groups a farm's expenses by category, biggest first", () => {
    const farmOne = report.expensesByFarm.find((f) => f.id === 'f1');
    expect(farmOne?.total).toBe(10000);
    expect(farmOne?.categories.map((c) => c.category)).toEqual(['seeds', 'labour']);
    // Two separate seed entries are added together.
    expect(farmOne?.categories[0].amount).toBe(7000);
    expect(farmOne?.categories[0].share).toBe(70);
  });

  it('groups the same expenses by crop', () => {
    const groundnut = report.expensesByCrop.find((c) => c.id === 'c1');
    expect(groundnut?.total).toBe(10000);
    expect(report.expensesByCrop.find((c) => c.id === 'c2')?.total).toBe(4000);
  });

  it('sorts farms by how much they cost', () => {
    expect(report.expensesByFarm.map((f) => f.id)).toEqual(['f1', 'f2']);
  });

  it('adds up to the season total', () => {
    const sum = report.expensesByFarm.reduce((s, f) => s + f.total, 0);
    expect(sum).toBe(report.totals.cost);
  });
});

describe('multiple harvests, farms and crops', () => {
  const data = dataset({
    farms: [farm('f1', 2), farm('f2', 3)],
    crops: [crop('c1', 'Groundnut'), crop('c2', 'Cotton')],
    allocations: [allocation('a1', 'f1', 'c1', 2), allocation('a2', 'f2', 'c2', 3)],
    harvests: [
      harvest('h1', 'f1', 8, { allocation_id: 'a1', crop_id: 'c1' }),
      harvest('h2', 'f1', 6, { allocation_id: 'a1', crop_id: 'c1' }),
      harvest('h3', 'f2', 9, { allocation_id: 'a2', crop_id: 'c2' }),
    ],
    sales: [sale('s1', 'f1', 14, 5000, { allocation_id: 'a1', crop_id: 'c1' })],
  });
  const report = buildSeasonReport(data);

  it('adds every harvest of the same crop', () => {
    expect(report.byCrop.find((c) => c.cropId === 'c1')?.yieldQuintal).toBe(14);
  });

  it('keeps crops separate', () => {
    expect(report.byCrop.find((c) => c.cropId === 'c2')?.yieldQuintal).toBe(9);
  });

  it('values harvested but unsold produce in expected revenue', () => {
    const cotton = report.byCrop.find((c) => c.cropId === 'c2');
    // No sale exists for cotton, so there is no realised price to value it with.
    expect(cotton?.expectedRevenue).toBe(0);
    const groundnut = report.byCrop.find((c) => c.cropId === 'c1');
    expect(groundnut?.revenue).toBe(70000);
  });
});

describe('sale deductions', () => {
  it('subtracts transport, commission and other deductions', () => {
    const data = dataset({
      farms: [farm('f1', 1)],
      crops: [crop('c1')],
      allocations: [allocation('a1', 'f1', 'c1', 1)],
      sales: [
        sale('s1', 'f1', 10, 5000, {
          allocation_id: 'a1',
          crop_id: 'c1',
          transport_cost: 1000,
          commission: 500,
          other_deductions: 250,
        }),
      ],
    });
    const report = buildSeasonReport(data);
    expect(report.totals.revenue).toBe(48250);
  });

  it('counts unpaid sales as outstanding revenue', () => {
    const data = dataset({
      farms: [farm('f1', 1)],
      sales: [sale('s1', 'f1', 2, 1000, { payment_status: 'pending', amount_received: 0 })],
    });
    expect(buildSeasonReport(data).totals.outstandingRevenue).toBe(2000);
  });
});

describe('safety against empty and zero values', () => {
  it('never produces NaN or Infinity on an empty dataset', () => {
    const report = buildSeasonReport(dataset());
    for (const value of Object.values(report.totals)) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(report.totals.roi).toBe(0);
    expect(report.totals.profitPerAcre).toBe(0);
  });

  it('returns zero ROI when there is revenue but no cost', () => {
    const data = dataset({
      farms: [farm('f1', 1)],
      sales: [sale('s1', 'f1', 1, 1000)],
    });
    const report = buildSeasonReport(data);
    expect(report.totals.roi).toBe(0);
    expect(Number.isFinite(report.totals.costPerQuintal)).toBe(true);
  });
});

describe('effort tracking', () => {
  const data = dataset({
    farms: [farm('f1', 2)],
    crops: [crop('c1')],
    allocations: [allocation('a1', 'f1', 'c1', 2)],
    activities: [
      activity('act1', 'f1', { allocation_id: 'a1', labour_days: 4, tractor_hours: 2 }),
      activity('act2', 'f1', { allocation_id: 'a1', labour_days: 2 }),
    ],
    irrigations: [irrigation('i1', 'f1', { allocation_id: 'a1' }), irrigation('i2', 'f1', { allocation_id: 'a1' })],
    sprays: [spray('sp1', 'f1', { allocation_id: 'a1' })],
  });
  const report = buildSeasonReport(data);

  it('counts activities, irrigations and sprays', () => {
    const farmReport = report.byFarm[0];
    expect(farmReport.irrigationCount).toBe(2);
    expect(farmReport.sprayCount).toBe(1);
    expect(farmReport.activityCount).toBe(5);
    expect(farmReport.labourDays).toBe(6);
    expect(farmReport.tractorHours).toBe(2);
  });

  it('scores effort per acre', () => {
    expect(computeEffortScore({ activityCount: 4, irrigationCount: 2, sprayCount: 1, labourCost: 0, labourDays: 2, tractorHours: 2 }, 2)).toBeGreaterThan(0);
    expect(computeEffortScore({ activityCount: 0, irrigationCount: 0, sprayCount: 0, labourCost: 0, labourDays: 0, tractorHours: 0 }, 0)).toBe(0);
  });
});

describe('monthly cash flow', () => {
  it('builds cumulative spend and income by month', () => {
    const data = dataset({
      farms: [farm('f1', 1)],
      expenses: [
        expense('e1', 1000, { farm_id: 'f1', date: '2026-06-05' }),
        expense('e2', 500, { farm_id: 'f1', date: '2026-07-05' }),
      ],
      sales: [sale('s1', 'f1', 1, 3000, { date: '2026-08-01' })],
    });
    const report = buildSeasonReport(data);
    expect(report.monthly.map((m) => m.month)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(report.monthly[1].cumulativeSpent).toBe(1500);
    expect(report.monthly[2].cumulativeReceived).toBe(3000);
  });
});

describe('filters', () => {
  const data = dataset({
    farms: [farm('f1', 2), farm('f2', 2)],
    crops: [crop('c1'), crop('c2')],
    allocations: [allocation('a1', 'f1', 'c1', 2), allocation('a2', 'f2', 'c2', 2)],
    expenses: [
      expense('e1', 1000, { farm_id: 'f1', allocation_id: 'a1', crop_id: 'c1', date: '2026-06-01', category: 'seeds' }),
      expense('e2', 2000, { farm_id: 'f2', allocation_id: 'a2', crop_id: 'c2', date: '2026-08-01', category: 'labour' }),
    ],
    expenseAllocations: [
      expenseAllocation('ea1', 'e1', 'f1', 1000, 'a1'),
      expenseAllocation('ea2', 'e2', 'f2', 2000, 'a2'),
    ],
  });

  it('filters by farm', () => {
    const report = buildSeasonReport(applyFilters(data, { farmId: 'f1' }));
    expect(report.totals.cost).toBe(1000);
  });

  it('filters by crop', () => {
    const report = buildSeasonReport(applyFilters(data, { cropId: 'c2' }));
    expect(report.totals.cost).toBe(2000);
  });

  it('filters by date range', () => {
    const report = buildSeasonReport(applyFilters(data, { dateFrom: '2026-07-01', dateTo: '2026-12-31' }));
    expect(report.totals.cost).toBe(2000);
  });

  it('filters by expense category', () => {
    const report = buildSeasonReport(applyFilters(data, { category: 'seeds' }));
    expect(report.totals.cost).toBe(1000);
  });

  it('returns the same dataset when no filter is set', () => {
    expect(applyFilters(data, {})).toBe(data);
  });
});
