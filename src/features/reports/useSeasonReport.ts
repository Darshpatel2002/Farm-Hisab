import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listRows } from '../../lib/supabase/crud';
import { buildSeasonReport, emptyDataset, type FinancialDataset, type SeasonReport } from '../../lib/calculations/profit';
import { applyFilters, type ReportFilters } from '../../lib/calculations/filters';
import { useAppData } from '../../hooks/useAppData';
import { useAuth } from '../../hooks/useAuth';
import type { ExpenseAllocation } from '../../types/db';

/**
 * Loads every row needed to calculate a season's financial picture and turns
 * it into a report. Nothing is precomputed in the database, so any edit is
 * reflected the next time this query runs.
 */

export type { ReportFilters };

export function useSeasonDataset(seasonId: string | null) {
  const { profile } = useAuth();
  const { unitMap, farms, crops } = useAppData();

  const query = useQuery({
    queryKey: ['season-dataset', profile?.household_id, seasonId],
    enabled: Boolean(profile && seasonId),
    queryFn: async (): Promise<Omit<FinancialDataset, 'units' | 'farms' | 'crops'>> => {
      const match = { season_id: seasonId as string };
      const [allocations, expenses, harvests, sales, activities, irrigations, sprays] = await Promise.all([
        listRows('farm_crop_allocations', { match }),
        listRows('expenses', { match, orderBy: { column: 'date', ascending: false } }),
        listRows('harvests', { match }),
        listRows('sales', { match }),
        listRows('activities', { match }),
        listRows('irrigation_records', { match }),
        listRows('spray_records', { match }),
      ]);

      // expense_allocations has no season column - it is scoped through its expense.
      const expenseIds = new Set(expenses.map((e) => e.id));
      const allExpenseAllocations = await listRows('expense_allocations', { includeDeleted: true });
      const expenseAllocations = (allExpenseAllocations as ExpenseAllocation[]).filter((a) =>
        expenseIds.has(a.expense_id),
      );

      return { allocations, expenses, expenseAllocations, harvests, sales, activities, irrigations, sprays };
    },
  });

  const dataset = useMemo<FinancialDataset>(() => {
    if (!query.data) return { ...emptyDataset(unitMap), farms, crops };
    return { ...query.data, units: unitMap, farms, crops };
  }, [query.data, unitMap, farms, crops]);

  return { dataset, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}

export function useSeasonReport(seasonId: string | null, filters: ReportFilters = {}) {
  const { dataset, isLoading, isError, refetch } = useSeasonDataset(seasonId);
  const filtered = useMemo(() => applyFilters(dataset, filters), [dataset, filters]);
  const report: SeasonReport = useMemo(() => buildSeasonReport(filtered), [filtered]);
  return { dataset: filtered, report, isLoading, isError, refetch };
}
