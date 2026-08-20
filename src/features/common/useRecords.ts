import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { insertRow, listRows, softDeleteRow, updateRow, type ListOptions } from '../../lib/supabase/crud';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { toAppError } from '../../lib/errors';
import type { TableName, Tables } from '../../types/db';

/**
 * Generic CRUD hooks shared by every feature.
 * They inject `household_id` / `created_by`, invalidate the right caches and
 * turn errors into friendly toasts.
 */

export function useRecords<T extends TableName>(table: T, options: ListOptions = {}, enabled = true) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: [table, profile?.household_id, options] as QueryKey,
    enabled: enabled && Boolean(profile),
    queryFn: () => listRows(table, options),
  });
}

/** Caches that must be refreshed when a table changes. */
const RELATED_KEYS: Partial<Record<TableName, TableName[]>> = {
  spray_records: ['expenses', 'expense_allocations'],
  irrigation_records: ['expenses', 'expense_allocations'],
  fertilizer_records: ['expenses', 'expense_allocations'],
  seed_records: ['expenses', 'expense_allocations'],
  activities: ['expenses', 'expense_allocations'],
  harvests: ['expenses', 'expense_allocations'],
  expenses: ['expense_allocations'],
};

export function useSaveRecord<T extends TableName>(table: T) {
  const queryClient = useQueryClient();
  const { profile, session } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      id,
      values,
      baseUpdatedAt,
    }: {
      id?: string;
      values: Record<string, unknown>;
      baseUpdatedAt?: string | null;
    }) => {
      if (!profile) throw toAppError({ status: 401, message: 'No profile' });
      const userId = session?.user.id ?? null;
      if (id) {
        return updateRow(table, id, { ...values, updated_by: userId }, baseUpdatedAt);
      }
      return insertRow(table, {
        ...values,
        household_id: profile.household_id,
        created_by: userId,
        updated_by: userId,
      });
    },
    onSuccess: async () => {
      toast.success(t('common.saved'));
      await queryClient.invalidateQueries({ queryKey: [table] });
      for (const related of RELATED_KEYS[table] ?? []) {
        await queryClient.invalidateQueries({ queryKey: [related] });
      }
      await queryClient.invalidateQueries({ queryKey: ['season-dataset'] });
    },
    onError: (error: unknown) => {
      toast.error(t(toAppError(error).messageKey));
    },
  });
}

export function useDeleteRecord<T extends TableName>(table: T) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => softDeleteRow(table, id),
    onSuccess: async () => {
      toast.success(t('common.deleted'));
      await queryClient.invalidateQueries({ queryKey: [table] });
      for (const related of RELATED_KEYS[table] ?? []) {
        await queryClient.invalidateQueries({ queryKey: [related] });
      }
      await queryClient.invalidateQueries({ queryKey: ['season-dataset'] });
    },
    onError: (error: unknown) => {
      toast.error(t(toAppError(error).messageKey));
    },
  });
}

export type RowOf<T extends TableName> = Tables[T];
