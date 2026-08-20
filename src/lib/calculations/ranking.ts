import { round, safeDivide } from '../formatting/number';
import type { CoreMetrics, CropReport, FarmReport } from './profit';

/**
 * Rankings, the balanced "Farm Performance Score" and the effort-vs-profit
 * quadrants. These are descriptive summaries of recorded history, not
 * predictions.
 */

export type RankMetric =
  | 'profit'
  | 'profitPerAcre'
  | 'revenue'
  | 'yieldPerAcre'
  | 'costPerAcre'
  | 'roi'
  | 'cost'
  | 'activityCount'
  | 'effortScore';

/** Metrics where a smaller value is the better result. */
const LOWER_IS_BETTER: ReadonlySet<RankMetric> = new Set(['costPerAcre', 'cost', 'effortScore', 'activityCount']);

export interface RankedItem<T> {
  rank: number;
  value: number;
  item: T;
}

export function rankBy<T extends CoreMetrics>(items: T[], metric: RankMetric, limit?: number): RankedItem<T>[] {
  const sorted = [...items].sort((a, b) => {
    const av = a[metric] as number;
    const bv = b[metric] as number;
    return LOWER_IS_BETTER.has(metric) ? av - bv : bv - av;
  });
  const sliced = limit ? sorted.slice(0, limit) : sorted;
  return sliced.map((item, index) => ({ rank: index + 1, value: item[metric] as number, item }));
}

/** Scales a value into 0..100 within the group; inverted for "lower is better". */
function normalise(value: number, values: number[], lowerIsBetter = false): number {
  if (values.length === 0) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 50;
  const ratio = (value - min) / (max - min);
  return round((lowerIsBetter ? 1 - ratio : ratio) * 100, 1);
}

export interface PerformanceScore<T> {
  item: T;
  score: number;
  parts: { profitPerAcre: number; roi: number; costPerAcre: number; yieldPerAcre: number };
}

/**
 * Farm Performance Score - a balanced 0-100 blend of four recorded numbers:
 *   40% profit per acre, 30% ROI, 15% low cost per acre, 15% yield per acre.
 * It is a comparison aid only; it is not a scientifically validated metric.
 */
export const PERFORMANCE_WEIGHTS = { profitPerAcre: 0.4, roi: 0.3, costPerAcre: 0.15, yieldPerAcre: 0.15 } as const;

export function performanceScores<T extends CoreMetrics>(items: T[]): PerformanceScore<T>[] {
  const profits = items.map((i) => i.profitPerAcre);
  const rois = items.map((i) => i.roi);
  const costs = items.map((i) => i.costPerAcre);
  const yields = items.map((i) => i.yieldPerAcre);

  return items
    .map((item) => {
      const parts = {
        profitPerAcre: normalise(item.profitPerAcre, profits),
        roi: normalise(item.roi, rois),
        costPerAcre: normalise(item.costPerAcre, costs, true),
        yieldPerAcre: normalise(item.yieldPerAcre, yields),
      };
      const score = round(
        parts.profitPerAcre * PERFORMANCE_WEIGHTS.profitPerAcre +
          parts.roi * PERFORMANCE_WEIGHTS.roi +
          parts.costPerAcre * PERFORMANCE_WEIGHTS.costPerAcre +
          parts.yieldPerAcre * PERFORMANCE_WEIGHTS.yieldPerAcre,
        1,
      );
      return { item, score, parts };
    })
    .sort((a, b) => b.score - a.score);
}

export type EffortQuadrant = 'highProfitLowEffort' | 'highProfitHighEffort' | 'lowProfitLowEffort' | 'lowProfitHighEffort';

export interface EffortPoint<T> {
  item: T;
  effort: number;
  profitPerAcre: number;
  quadrant: EffortQuadrant;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Splits items into the four effort-vs-profit quadrants around the medians. */
export function effortVsProfit<T extends CoreMetrics>(items: T[]): {
  points: EffortPoint<T>[];
  effortMedian: number;
  profitMedian: number;
} {
  const effortMedian = median(items.map((i) => i.effortScore));
  const profitMedian = median(items.map((i) => i.profitPerAcre));

  const points = items.map((item) => {
    const highEffort = item.effortScore > effortMedian;
    const highProfit = item.profitPerAcre > profitMedian;
    const quadrant: EffortQuadrant = highProfit
      ? highEffort
        ? 'highProfitHighEffort'
        : 'highProfitLowEffort'
      : highEffort
        ? 'lowProfitHighEffort'
        : 'lowProfitLowEffort';
    return { item, effort: item.effortScore, profitPerAcre: item.profitPerAcre, quadrant };
  });

  return { points, effortMedian: round(effortMedian, 2), profitMedian: round(profitMedian, 2) };
}

export interface BestCropAnalysis {
  highestTotalProfit: CropReport | null;
  highestProfitPerAcre: CropReport | null;
  highestRoi: CropReport | null;
  highestYieldPerAcre: CropReport | null;
  lowestCostPerAcre: CropReport | null;
  bestValue: PerformanceScore<CropReport> | null;
  scores: PerformanceScore<CropReport>[];
}

export function analyseBestCrops(crops: CropReport[]): BestCropAnalysis {
  const withActivity = crops.filter((c) => c.acres > 0);
  const pick = (metric: RankMetric) => rankBy(withActivity, metric, 1)[0]?.item ?? null;
  const scores = performanceScores(withActivity);

  return {
    highestTotalProfit: pick('profit'),
    highestProfitPerAcre: pick('profitPerAcre'),
    highestRoi: pick('roi'),
    highestYieldPerAcre: pick('yieldPerAcre'),
    lowestCostPerAcre: withActivity.length > 0 ? pick('costPerAcre') : null,
    bestValue: scores[0] ?? null,
    scores,
  };
}

export interface ComparisonRow {
  key: string;
  label: string;
  values: Array<{ id: string; label: string; value: number }>;
}

/** Builds side-by-side comparison rows for the farm/crop comparison screens. */
export function buildComparison<T extends CoreMetrics>(
  items: Array<{ id: string; label: string; metrics: T }>,
  metrics: Array<{ key: RankMetric | keyof CoreMetrics; label: string }>,
): ComparisonRow[] {
  return metrics.map((metric) => ({
    key: String(metric.key),
    label: metric.label,
    values: items.map((item) => ({
      id: item.id,
      label: item.label,
      value: round(Number(item.metrics[metric.key as keyof CoreMetrics] ?? 0), 2),
    })),
  }));
}

export interface YearChange {
  label: string;
  previous: number;
  current: number;
  change: number;
  changePercent: number;
}

export function compareYears(
  previous: CoreMetrics | null,
  current: CoreMetrics | null,
  metrics: Array<{ key: keyof CoreMetrics; label: string }>,
): YearChange[] {
  return metrics.map(({ key, label }) => {
    const prev = Number(previous?.[key] ?? 0);
    const curr = Number(current?.[key] ?? 0);
    return {
      label,
      previous: round(prev, 2),
      current: round(curr, 2),
      change: round(curr - prev, 2),
      changePercent: round(safeDivide(curr - prev, Math.abs(prev)) * 100, 1),
    };
  });
}

export function farmRankings(farms: FarmReport[]) {
  return {
    byProfit: rankBy(farms, 'profit'),
    byProfitPerAcre: rankBy(farms, 'profitPerAcre'),
    byRevenue: rankBy(farms, 'revenue'),
    byYieldPerAcre: rankBy(farms, 'yieldPerAcre'),
    byCostPerAcre: rankBy(farms, 'costPerAcre'),
    byRoi: rankBy(farms, 'roi'),
  };
}

export function cropRankings(crops: CropReport[]) {
  return {
    byProfit: rankBy(crops, 'profit'),
    byProfitPerAcre: rankBy(crops, 'profitPerAcre'),
    byRevenue: rankBy(crops, 'revenue'),
    byRoi: rankBy(crops, 'roi'),
    byYieldPerAcre: rankBy(crops, 'yieldPerAcre'),
    byCostPerAcre: rankBy(crops, 'costPerAcre'),
    byEffort: rankBy(crops, 'activityCount'),
  };
}
