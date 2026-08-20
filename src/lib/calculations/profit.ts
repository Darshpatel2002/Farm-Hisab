import { round, safeDivide, safeNumber } from '../formatting/number';
import { monthKey } from '../formatting/date';
import { toAcres, toQuintal, type UnitMap } from './units';
import type {
  Activity,
  Crop,
  Expense,
  ExpenseAllocation,
  Farm,
  FarmCropAllocation,
  Harvest,
  IrrigationRecord,
  Sale,
  SprayRecord,
} from '../../types/db';

/**
 * The reporting engine.
 *
 * Profit is NEVER stored. Every figure below is derived from the raw rows:
 *   cost    <- expenses / expense_allocations
 *   yield   <- harvests
 *   revenue <- sales
 *
 * Double counting rule:
 *   grand totals read `expenses.amount`
 *   per-farm and per-crop figures read `expense_allocations.amount`
 * The two are never summed together.
 */

export interface FinancialDataset {
  units: UnitMap;
  farms: Farm[];
  crops: Crop[];
  allocations: FarmCropAllocation[];
  expenses: Expense[];
  expenseAllocations: ExpenseAllocation[];
  harvests: Harvest[];
  sales: Sale[];
  activities: Activity[];
  irrigations: IrrigationRecord[];
  sprays: SprayRecord[];
}

export const emptyDataset = (units: UnitMap = {}): FinancialDataset => ({
  units,
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
});

export interface EffortMetrics {
  activityCount: number;
  irrigationCount: number;
  sprayCount: number;
  labourCost: number;
  labourDays: number;
  tractorHours: number;
}

export interface CoreMetrics extends EffortMetrics {
  acres: number;
  cost: number;
  revenue: number;
  /** Revenue already earned plus the value of harvested-but-unsold produce. */
  expectedRevenue: number;
  profit: number;
  yieldQuintal: number;
  soldQuintal: number;
  profitPerAcre: number;
  revenuePerAcre: number;
  costPerAcre: number;
  yieldPerAcre: number;
  revenuePerQuintal: number;
  costPerQuintal: number;
  profitPerQuintal: number;
  roi: number;
  effortScore: number;
}

export interface AllocationReport extends CoreMetrics {
  allocationId: string;
  farmId: string;
  cropId: string;
  farmName: string;
  cropName: string;
  status: string;
  sowingDate: string | null;
  expectedHarvestDate: string | null;
}

export interface FarmReport extends CoreMetrics {
  farmId: string;
  name: string;
  localName: string;
  cropIds: string[];
  allocationCount: number;
}

export interface CropReport extends CoreMetrics {
  cropId: string;
  name: string;
  nameGu: string;
  farmCount: number;
}

export interface CategoryTotal {
  category: string;
  amount: number;
  share: number;
}

export interface MonthlyFlow {
  month: string;
  spent: number;
  received: number;
  cumulativeSpent: number;
  cumulativeReceived: number;
}

export interface SeasonReport {
  totals: CoreMetrics & { farmCount: number; cropCount: number; unallocatedCost: number; outstandingRevenue: number };
  byAllocation: AllocationReport[];
  byFarm: FarmReport[];
  byCrop: CropReport[];
  byCategory: CategoryTotal[];
  monthly: MonthlyFlow[];
}

const zeroEffort = (): EffortMetrics => ({
  activityCount: 0,
  irrigationCount: 0,
  sprayCount: 0,
  labourCost: 0,
  labourDays: 0,
  tractorHours: 0,
});

interface Accumulator extends EffortMetrics {
  acres: number;
  cost: number;
  revenue: number;
  yieldQuintal: number;
  soldQuintal: number;
  unsoldValue: number;
}

const zeroAccumulator = (): Accumulator => ({
  ...zeroEffort(),
  acres: 0,
  cost: 0,
  revenue: 0,
  yieldQuintal: 0,
  soldQuintal: 0,
  unsoldValue: 0,
});

function bucket<T>(map: Map<string, T>, key: string, create: () => T): T {
  let value = map.get(key);
  if (!value) {
    value = create();
    map.set(key, value);
  }
  return value;
}

/**
 * Effort is a simple, explainable count-based indicator - not a scientific
 * measure. It is documented in the UI wherever it is shown.
 */
export function computeEffortScore(effort: EffortMetrics, acres: number): number {
  const perAcre = (value: number) => safeDivide(value, acres > 0 ? acres : 1);
  const score =
    perAcre(effort.activityCount) * 1 +
    perAcre(effort.irrigationCount) * 1.5 +
    perAcre(effort.sprayCount) * 2 +
    perAcre(effort.labourDays) * 1.5 +
    perAcre(effort.tractorHours) * 0.5;
  return round(score, 2);
}

function finalise(acc: Accumulator): CoreMetrics {
  const acres = round(acc.acres, 4);
  const cost = round(acc.cost, 2);
  const revenue = round(acc.revenue, 2);
  const expectedRevenue = round(acc.revenue + acc.unsoldValue, 2);
  const profit = round(revenue - cost, 2);
  const yieldQuintal = round(acc.yieldQuintal, 3);
  const effort: EffortMetrics = {
    activityCount: acc.activityCount,
    irrigationCount: acc.irrigationCount,
    sprayCount: acc.sprayCount,
    labourCost: round(acc.labourCost, 2),
    labourDays: round(acc.labourDays, 2),
    tractorHours: round(acc.tractorHours, 2),
  };

  return {
    ...effort,
    acres,
    cost,
    revenue,
    expectedRevenue,
    profit,
    yieldQuintal,
    soldQuintal: round(acc.soldQuintal, 3),
    profitPerAcre: round(safeDivide(profit, acres), 2),
    revenuePerAcre: round(safeDivide(revenue, acres), 2),
    costPerAcre: round(safeDivide(cost, acres), 2),
    yieldPerAcre: round(safeDivide(yieldQuintal, acres), 3),
    revenuePerQuintal: round(safeDivide(revenue, yieldQuintal), 2),
    costPerQuintal: round(safeDivide(cost, yieldQuintal), 2),
    profitPerQuintal: round(safeDivide(profit, yieldQuintal), 2),
    roi: round(safeDivide(profit, cost) * 100, 1),
    effortScore: computeEffortScore(effort, acres),
  };
}

const LABOUR_CATEGORIES = new Set(['labour', 'harvesting', 'sowing']);

/** Average realised price per quintal for a crop, used to value unsold stock. */
function averagePriceByCrop(sales: Sale[], units: UnitMap): Map<string, number> {
  const totals = new Map<string, { amount: number; quintal: number }>();
  for (const sale of sales) {
    if (!sale.crop_id) continue;
    const entry = bucket(totals, sale.crop_id, () => ({ amount: 0, quintal: 0 }));
    entry.amount += safeNumber(sale.net_amount);
    entry.quintal += toQuintal(units, safeNumber(sale.quantity), sale.unit);
  }
  const result = new Map<string, number>();
  for (const [cropId, entry] of totals) result.set(cropId, safeDivide(entry.amount, entry.quintal));
  return result;
}

export function buildSeasonReport(dataset: FinancialDataset): SeasonReport {
  const { units } = dataset;
  const farmById = new Map(dataset.farms.map((f) => [f.id, f]));
  const cropById = new Map(dataset.crops.map((c) => [c.id, c]));
  const allocationById = new Map(dataset.allocations.map((a) => [a.id, a]));
  const expenseById = new Map(dataset.expenses.map((e) => [e.id, e]));
  const avgPrice = averagePriceByCrop(dataset.sales, units);

  const byAllocation = new Map<string, Accumulator>();
  const byFarm = new Map<string, Accumulator>();
  const byCrop = new Map<string, Accumulator>();
  const byCategory = new Map<string, number>();
  const monthly = new Map<string, { spent: number; received: number }>();

  const farmCropIds = new Map<string, Set<string>>();
  const cropFarmIds = new Map<string, Set<string>>();

  // ---- Area -----------------------------------------------------------
  for (const allocation of dataset.allocations) {
    const acres = safeNumber(allocation.acre_equivalent) || toAcres(units, allocation.area, allocation.area_unit);
    bucket(byAllocation, allocation.id, zeroAccumulator).acres += acres;
    bucket(byFarm, allocation.farm_id, zeroAccumulator).acres += acres;
    bucket(byCrop, allocation.crop_id, zeroAccumulator).acres += acres;
    bucket(farmCropIds, allocation.farm_id, () => new Set<string>()).add(allocation.crop_id);
    bucket(cropFarmIds, allocation.crop_id, () => new Set<string>()).add(allocation.farm_id);
  }

  // ---- Cost -----------------------------------------------------------
  // Grand total comes from `expenses`; per-farm/per-crop from allocations.
  let grandCost = 0;
  for (const expense of dataset.expenses) {
    const amount = safeNumber(expense.amount);
    grandCost += amount;
    byCategory.set(expense.category, round((byCategory.get(expense.category) ?? 0) + amount, 2));
    const month = monthKey(expense.date);
    bucket(monthly, month, () => ({ spent: 0, received: 0 })).spent += amount;
  }

  let allocatedCost = 0;
  for (const line of dataset.expenseAllocations) {
    const amount = safeNumber(line.amount);
    allocatedCost += amount;
    const expense = expenseById.get(line.expense_id);
    const allocation = line.allocation_id ? allocationById.get(line.allocation_id) : undefined;
    const cropId = allocation?.crop_id ?? expense?.crop_id ?? null;
    const isLabour = expense ? LABOUR_CATEGORIES.has(expense.category) : false;

    const farmAcc = bucket(byFarm, line.farm_id, zeroAccumulator);
    farmAcc.cost += amount;
    if (isLabour) farmAcc.labourCost += amount;

    if (allocation) {
      const allocAcc = bucket(byAllocation, allocation.id, zeroAccumulator);
      allocAcc.cost += amount;
      if (isLabour) allocAcc.labourCost += amount;
    }
    if (cropId) {
      const cropAcc = bucket(byCrop, cropId, zeroAccumulator);
      cropAcc.cost += amount;
      if (isLabour) cropAcc.labourCost += amount;
    }
  }

  // ---- Yield ----------------------------------------------------------
  for (const harvest of dataset.harvests) {
    const quintal = toQuintal(units, safeNumber(harvest.net_quantity), harvest.unit);
    const allocation = harvest.allocation_id ? allocationById.get(harvest.allocation_id) : undefined;
    const cropId = allocation?.crop_id ?? harvest.crop_id ?? null;
    bucket(byFarm, harvest.farm_id, zeroAccumulator).yieldQuintal += quintal;
    if (allocation) bucket(byAllocation, allocation.id, zeroAccumulator).yieldQuintal += quintal;
    if (cropId) bucket(byCrop, cropId, zeroAccumulator).yieldQuintal += quintal;
  }

  // ---- Revenue --------------------------------------------------------
  let outstandingRevenue = 0;
  for (const sale of dataset.sales) {
    const net = safeNumber(sale.net_amount);
    const quintal = toQuintal(units, safeNumber(sale.quantity), sale.unit);
    const allocation = sale.allocation_id ? allocationById.get(sale.allocation_id) : undefined;
    const farmId = allocation?.farm_id ?? sale.farm_id ?? null;
    const cropId = allocation?.crop_id ?? sale.crop_id ?? null;

    if (sale.payment_status !== 'received') {
      outstandingRevenue += Math.max(net - safeNumber(sale.amount_received), 0);
    }
    const month = monthKey(sale.date);
    bucket(monthly, month, () => ({ spent: 0, received: 0 })).received += net;

    if (farmId) {
      const acc = bucket(byFarm, farmId, zeroAccumulator);
      acc.revenue += net;
      acc.soldQuintal += quintal;
    }
    if (allocation) {
      const acc = bucket(byAllocation, allocation.id, zeroAccumulator);
      acc.revenue += net;
      acc.soldQuintal += quintal;
    }
    if (cropId) {
      const acc = bucket(byCrop, cropId, zeroAccumulator);
      acc.revenue += net;
      acc.soldQuintal += quintal;
    }
  }

  // Harvested but not yet sold produce, valued at the crop's realised price.
  const valueUnsold = (acc: Accumulator, cropId: string | null) => {
    const unsold = Math.max(acc.yieldQuintal - acc.soldQuintal, 0);
    acc.unsoldValue = unsold * (cropId ? (avgPrice.get(cropId) ?? 0) : 0);
  };
  for (const [allocationId, acc] of byAllocation) valueUnsold(acc, allocationById.get(allocationId)?.crop_id ?? null);
  for (const [cropId, acc] of byCrop) valueUnsold(acc, cropId);
  for (const [farmId, acc] of byFarm) {
    const cropIds = [...(farmCropIds.get(farmId) ?? [])];
    const unsold = Math.max(acc.yieldQuintal - acc.soldQuintal, 0);
    const price = cropIds.length > 0 ? safeDivide(cropIds.reduce((s, id) => s + (avgPrice.get(id) ?? 0), 0), cropIds.length) : 0;
    acc.unsoldValue = unsold * price;
  }

  // ---- Effort ---------------------------------------------------------
  const addEffort = (
    farmId: string | null,
    allocationId: string | null,
    apply: (acc: Accumulator) => void,
  ) => {
    const allocation = allocationId ? allocationById.get(allocationId) : undefined;
    if (farmId) apply(bucket(byFarm, farmId, zeroAccumulator));
    if (allocation) {
      apply(bucket(byAllocation, allocation.id, zeroAccumulator));
      apply(bucket(byCrop, allocation.crop_id, zeroAccumulator));
    }
  };

  for (const activity of dataset.activities) {
    addEffort(activity.farm_id, activity.allocation_id, (acc) => {
      acc.activityCount += 1;
      acc.labourDays += safeNumber(activity.labour_days);
      acc.tractorHours += safeNumber(activity.tractor_hours);
    });
  }
  for (const irrigation of dataset.irrigations) {
    addEffort(irrigation.farm_id, irrigation.allocation_id, (acc) => {
      acc.irrigationCount += 1;
      acc.activityCount += 1;
    });
  }
  for (const spray of dataset.sprays) {
    addEffort(spray.farm_id, spray.allocation_id, (acc) => {
      acc.sprayCount += 1;
      acc.activityCount += 1;
    });
    // Crop-wide sprays have no farm or allocation but still count as effort for the crop.
    if (!spray.allocation_id && spray.crop_id) {
      const acc = bucket(byCrop, spray.crop_id, zeroAccumulator);
      acc.sprayCount += 1;
      acc.activityCount += 1;
    }
  }

  // ---- Shape the result ----------------------------------------------
  const allocationReports: AllocationReport[] = dataset.allocations.map((allocation) => {
    const metrics = finalise(byAllocation.get(allocation.id) ?? zeroAccumulator());
    return {
      ...metrics,
      allocationId: allocation.id,
      farmId: allocation.farm_id,
      cropId: allocation.crop_id,
      farmName: farmById.get(allocation.farm_id)?.name ?? '',
      cropName: cropById.get(allocation.crop_id)?.name ?? '',
      status: allocation.status,
      sowingDate: allocation.sowing_date,
      expectedHarvestDate: allocation.expected_harvest_date,
    };
  });

  const farmReports: FarmReport[] = dataset.farms.map((farm) => {
    const acc = byFarm.get(farm.id) ?? zeroAccumulator();
    // A farm with no crop allocation still has its own land area.
    if (acc.acres === 0) acc.acres = safeNumber(farm.acre_equivalent);
    return {
      ...finalise(acc),
      farmId: farm.id,
      name: farm.name,
      localName: farm.local_name,
      cropIds: [...(farmCropIds.get(farm.id) ?? [])],
      allocationCount: dataset.allocations.filter((a) => a.farm_id === farm.id).length,
    };
  });

  const cropReports: CropReport[] = dataset.crops
    .map((crop) => ({
      ...finalise(byCrop.get(crop.id) ?? zeroAccumulator()),
      cropId: crop.id,
      name: crop.name,
      nameGu: crop.name_gu,
      farmCount: (cropFarmIds.get(crop.id) ?? new Set()).size,
    }))
    .filter((c) => c.acres > 0 || c.cost > 0 || c.revenue > 0);

  const totalRevenue = round(dataset.sales.reduce((sum, s) => sum + safeNumber(s.net_amount), 0), 2);
  const totalAcres = round(dataset.allocations.reduce((sum, a) => sum + safeNumber(a.acre_equivalent), 0), 4);
  const totalYield = round(
    dataset.harvests.reduce((sum, h) => sum + toQuintal(units, safeNumber(h.net_quantity), h.unit), 0),
    3,
  );
  const totalSold = round(
    dataset.sales.reduce((sum, s) => sum + toQuintal(units, safeNumber(s.quantity), s.unit), 0),
    3,
  );
  const totalEffort: EffortMetrics = {
    activityCount: dataset.activities.length + dataset.irrigations.length + dataset.sprays.length,
    irrigationCount: dataset.irrigations.length,
    sprayCount: dataset.sprays.length,
    labourCost: round(
      dataset.expenses.filter((e) => LABOUR_CATEGORIES.has(e.category)).reduce((s, e) => s + safeNumber(e.amount), 0),
      2,
    ),
    labourDays: round(dataset.activities.reduce((s, a) => s + safeNumber(a.labour_days), 0), 2),
    tractorHours: round(dataset.activities.reduce((s, a) => s + safeNumber(a.tractor_hours), 0), 2),
  };

  const grandAcc: Accumulator = {
    ...totalEffort,
    acres: totalAcres,
    cost: round(grandCost, 2),
    revenue: totalRevenue,
    yieldQuintal: totalYield,
    soldQuintal: totalSold,
    unsoldValue: round(
      cropReports.reduce((sum, c) => sum + Math.max(c.expectedRevenue - c.revenue, 0), 0),
      2,
    ),
  };

  const categories: CategoryTotal[] = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount, share: round(safeDivide(amount, grandCost) * 100, 1) }))
    .sort((a, b) => b.amount - a.amount);

  let cumulativeSpent = 0;
  let cumulativeReceived = 0;
  const monthlyFlow: MonthlyFlow[] = [...monthly.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, value]) => {
      cumulativeSpent = round(cumulativeSpent + value.spent, 2);
      cumulativeReceived = round(cumulativeReceived + value.received, 2);
      return {
        month,
        spent: round(value.spent, 2),
        received: round(value.received, 2),
        cumulativeSpent,
        cumulativeReceived,
      };
    });

  return {
    totals: {
      ...finalise(grandAcc),
      farmCount: dataset.farms.length,
      cropCount: cropReports.length,
      unallocatedCost: round(grandCost - allocatedCost, 2),
      outstandingRevenue: round(outstandingRevenue, 2),
    },
    byAllocation: allocationReports,
    byFarm: farmReports,
    byCrop: cropReports,
    byCategory: categories,
    monthly: monthlyFlow,
  };
}
