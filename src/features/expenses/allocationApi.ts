import { supabase } from '../../lib/supabase/client';
import { toAppError } from '../../lib/errors';
import { allocateExpense, type AllocationBasis, type AllocationTarget } from '../../lib/calculations/allocation';
import type { Expense, ExpenseSource } from '../../types/db';

/**
 * Helpers for splitting a single expense across farms.
 *
 * The expense row itself is never duplicated: only `expense_allocations`
 * rows are rewritten, so grand totals stay correct.
 */

export async function findSourceExpense(sourceType: ExpenseSource, sourceId: string): Promise<Expense | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return (data as Expense | null) ?? null;
}

export async function replaceExpenseAllocations(params: {
  householdId: string;
  expenseId: string;
  total: number;
  targets: AllocationTarget[];
  basis: AllocationBasis;
}): Promise<void> {
  const { householdId, expenseId, total, targets, basis } = params;
  const lines = allocateExpense(total, targets, basis).filter((line) => line.amount > 0);

  // Delete first so the "allocated total must not exceed the expense" trigger
  // never sees the old and new lines at the same time.
  const { error: deleteError } = await supabase.from('expense_allocations').delete().eq('expense_id', expenseId);
  if (deleteError) throw toAppError(deleteError);

  if (lines.length === 0) return;

  const { error } = await supabase.from('expense_allocations').insert(
    lines.map((line) => ({
      household_id: householdId,
      expense_id: expenseId,
      farm_id: line.farmId,
      allocation_id: line.allocationId,
      amount: line.amount,
      basis: line.basis,
    })),
  );
  if (error) throw toAppError(error);
}

export async function loadExpenseAllocations(expenseId: string) {
  const { data, error } = await supabase.from('expense_allocations').select('*').eq('expense_id', expenseId);
  if (error) throw toAppError(error);
  return data ?? [];
}
