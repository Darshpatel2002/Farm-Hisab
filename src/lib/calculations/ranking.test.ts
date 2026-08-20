import { describe, expect, it } from 'vitest';
import { analyseBestCrops, compareYears, effortVsProfit, performanceScores, rankBy } from './ranking';
import type { CropReport, FarmReport } from './profit';

function cropReport(id: string, values: Partial<CropReport>): CropReport {
  return {
    cropId: id,
    name: id,
    nameGu: '',
    farmCount: 1,
    acres: 1,
    cost: 0,
    revenue: 0,
    expectedRevenue: 0,
    profit: 0,
    yieldQuintal: 0,
    soldQuintal: 0,
    profitPerAcre: 0,
    revenuePerAcre: 0,
    costPerAcre: 0,
    yieldPerAcre: 0,
    revenuePerQuintal: 0,
    costPerQuintal: 0,
    profitPerQuintal: 0,
    roi: 0,
    effortScore: 0,
    activityCount: 0,
    irrigationCount: 0,
    sprayCount: 0,
    labourCost: 0,
    labourDays: 0,
    tractorHours: 0,
    ...values,
  };
}

const crops = [
  cropReport('groundnut', { acres: 4, profit: 120000, profitPerAcre: 30000, roi: 78, yieldPerAcre: 9, costPerAcre: 18000 }),
  cropReport('cotton', { acres: 4, profit: 95000, profitPerAcre: 23750, roi: 51, yieldPerAcre: 7, costPerAcre: 26000 }),
  cropReport('wheat', { acres: 2, profit: 40000, profitPerAcre: 20000, roi: 90, yieldPerAcre: 14, costPerAcre: 12000 }),
];

describe('rankBy', () => {
  it('ranks descending for higher-is-better metrics', () => {
    expect(rankBy(crops, 'profit').map((r) => r.item.cropId)).toEqual(['groundnut', 'cotton', 'wheat']);
  });

  it('ranks ascending for cost per acre', () => {
    expect(rankBy(crops, 'costPerAcre')[0].item.cropId).toBe('wheat');
  });

  it('limits the result', () => {
    expect(rankBy(crops, 'profit', 2)).toHaveLength(2);
  });

  it('handles an empty list', () => {
    expect(rankBy([] as FarmReport[], 'profit')).toEqual([]);
  });
});

describe('analyseBestCrops', () => {
  const analysis = analyseBestCrops(crops);

  it('answers each question separately', () => {
    expect(analysis.highestTotalProfit?.cropId).toBe('groundnut');
    expect(analysis.highestProfitPerAcre?.cropId).toBe('groundnut');
    expect(analysis.highestRoi?.cropId).toBe('wheat');
    expect(analysis.highestYieldPerAcre?.cropId).toBe('wheat');
    expect(analysis.lowestCostPerAcre?.cropId).toBe('wheat');
  });

  it('produces a balanced score between 0 and 100', () => {
    for (const score of analysis.scores) {
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
    }
    expect(analysis.bestValue?.item.cropId).toBeDefined();
  });

  it('returns nulls when nothing has been recorded', () => {
    const empty = analyseBestCrops([]);
    expect(empty.highestTotalProfit).toBeNull();
    expect(empty.bestValue).toBeNull();
  });
});

describe('performanceScores', () => {
  it('gives every item 50 when they are identical', () => {
    const same = [cropReport('a', { profitPerAcre: 100, roi: 10, costPerAcre: 5, yieldPerAcre: 2 }), cropReport('b', { profitPerAcre: 100, roi: 10, costPerAcre: 5, yieldPerAcre: 2 })];
    expect(performanceScores(same).every((s) => s.score === 50)).toBe(true);
  });
});

describe('effortVsProfit', () => {
  it('places items into the four quadrants', () => {
    const items = [
      cropReport('a', { effortScore: 1, profitPerAcre: 30000 }),
      cropReport('b', { effortScore: 9, profitPerAcre: 30000 }),
      cropReport('c', { effortScore: 1, profitPerAcre: 1000 }),
      cropReport('d', { effortScore: 9, profitPerAcre: 1000 }),
    ];
    const { points } = effortVsProfit(items);
    expect(points.find((p) => p.item.cropId === 'a')?.quadrant).toBe('highProfitLowEffort');
    expect(points.find((p) => p.item.cropId === 'b')?.quadrant).toBe('highProfitHighEffort');
    expect(points.find((p) => p.item.cropId === 'd')?.quadrant).toBe('lowProfitHighEffort');
  });
});

describe('compareYears', () => {
  it('calculates the change and percentage between two seasons', () => {
    const rows = compareYears(
      cropReport('prev', { profitPerAcre: 25000 }),
      cropReport('curr', { profitPerAcre: 31000 }),
      [{ key: 'profitPerAcre', label: 'Profit per acre' }],
    );
    expect(rows[0].change).toBe(6000);
    expect(rows[0].changePercent).toBe(24);
  });

  it('does not divide by zero when the previous season is empty', () => {
    const rows = compareYears(null, cropReport('curr', { profit: 5000 }), [{ key: 'profit', label: 'Profit' }]);
    expect(Number.isFinite(rows[0].changePercent)).toBe(true);
    expect(rows[0].changePercent).toBe(0);
  });
});
