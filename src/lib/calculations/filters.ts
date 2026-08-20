import type { FinancialDataset } from './profit';

/** Report filter selections shared by the reports screen and the tests. */
export interface ReportFilters {
  farmId?: string | null;
  cropId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  category?: string | null;
}

/**
 * Narrows a season dataset by farm, crop, date range and expense category.
 * Filtering happens on the raw rows so every derived figure stays consistent.
 */
export function applyFilters(dataset: FinancialDataset, filters: ReportFilters): FinancialDataset {
  const { farmId, cropId, dateFrom, dateTo, category } = filters;
  if (!farmId && !cropId && !dateFrom && !dateTo && !category) return dataset;

  const allocationIds = new Set(
    dataset.allocations
      .filter((a) => (!farmId || a.farm_id === farmId) && (!cropId || a.crop_id === cropId))
      .map((a) => a.id),
  );

  const inRange = (date: string) => (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);

  const matchesFarmCrop = (row: {
    farm_id?: string | null;
    crop_id?: string | null;
    allocation_id?: string | null;
  }): boolean => {
    const viaAllocation = Boolean(row.allocation_id && allocationIds.has(row.allocation_id));
    if (farmId && row.farm_id !== farmId && !viaAllocation) return false;
    if (cropId && row.crop_id !== cropId && !viaAllocation) return false;
    return true;
  };

  const allocations = dataset.allocations.filter((a) => allocationIds.has(a.id));
  const expenses = dataset.expenses.filter(
    (e) => inRange(e.date) && matchesFarmCrop(e) && (!category || e.category === category),
  );
  const expenseIds = new Set(expenses.map((e) => e.id));

  return {
    ...dataset,
    farms: farmId ? dataset.farms.filter((f) => f.id === farmId) : dataset.farms,
    crops: cropId ? dataset.crops.filter((c) => c.id === cropId) : dataset.crops,
    allocations,
    expenseAllocations: dataset.expenseAllocations.filter(
      (a) => expenseIds.has(a.expense_id) && (!farmId || a.farm_id === farmId),
    ),
    expenses,
    harvests: dataset.harvests.filter((h) => inRange(h.start_date) && matchesFarmCrop(h)),
    sales: dataset.sales.filter((s) => inRange(s.date) && matchesFarmCrop(s)),
    activities: dataset.activities.filter((a) => inRange(a.date) && matchesFarmCrop(a)),
    irrigations: dataset.irrigations.filter((i) => inRange(i.date) && matchesFarmCrop(i)),
    sprays: dataset.sprays.filter((s) => inRange(s.date) && matchesFarmCrop(s)),
  };
}
