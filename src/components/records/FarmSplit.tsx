import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppData } from '../../hooks/useAppData';
import { allocateExpense, ratePerAcre, unallocatedAmount, type AllocationBasis } from '../../lib/calculations/allocation';
import { currencySymbol, formatCurrency, formatNumber, safeNumber } from '../../lib/formatting/number';

/**
 * Chooses which farms carry a shared expense and shows the resulting split.
 * The user always sees how much is still unsplit, so money cannot silently
 * disappear or be counted twice.
 */

export interface SplitLine {
  farmId: string;
  amount: number;
}

export function FarmSplit({
  total,
  basis,
  selected,
  manualAmounts,
  onToggleFarm,
  onManualChange,
}: {
  total: number;
  basis: AllocationBasis;
  selected: string[];
  manualAmounts: Record<string, string>;
  onToggleFarm: (farmId: string, checked: boolean) => void;
  onManualChange: (farmId: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const { farms } = useAppData();

  const targets = useMemo(
    () =>
      selected.map((farmId) => ({
        farmId,
        acres: safeNumber(farms.find((f) => f.id === farmId)?.acre_equivalent),
        amount: safeNumber(manualAmounts[farmId]),
      })),
    [selected, farms, manualAmounts],
  );

  const lines = useMemo(() => allocateExpense(total, targets, basis), [total, targets, basis]);
  const remaining = unallocatedAmount(total, lines);
  const perAcre = ratePerAcre(total, targets);

  return (
    <fieldset className="mb-4 rounded-2xl border-2 border-slate-200 p-3 dark:border-slate-700">
      <legend className="px-1 text-base font-bold">{t('expenses.sharedTitle')}</legend>
      <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{t('expenses.sharedHelp')}</p>

      {basis === 'area' && perAcre > 0 ? (
        <p className="mb-2 text-sm font-semibold text-brand-800 dark:text-brand-200">
          {t('expenses.perAcreRate', { amount: formatCurrency(perAcre) })}
        </p>
      ) : null}

      <ul className="space-y-2">
        {farms.map((farm) => {
          const checked = selected.includes(farm.id);
          const line = lines.find((l) => l.farmId === farm.id);
          return (
            <li key={farm.id} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggleFarm(farm.id, e.target.checked)}
                  className="h-6 w-6 rounded border-2 border-slate-400 text-brand-700"
                />
                <span className="flex-1 text-base font-semibold">
                  {farm.name}
                  <span className="block text-sm font-normal text-slate-600 dark:text-slate-400">
                    {formatNumber(farm.acre_equivalent, 2)} {t('common.acres')}
                  </span>
                </span>
                {checked && basis !== 'manual' ? (
                  <span className="text-base font-bold">{formatCurrency(line?.amount ?? 0)}</span>
                ) : null}
              </label>

              {checked && basis === 'manual' ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-base font-semibold">{currencySymbol()}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    aria-label={`${t('common.amount')} - ${farm.name}`}
                    value={manualAmounts[farm.id] ?? ''}
                    onChange={(e) => onManualChange(farm.id, e.target.value)}
                    className="input"
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 text-base font-bold dark:border-slate-700">
        <span>{t('expenses.allocated')}</span>
        <span>{formatCurrency(total - remaining)}</span>
      </div>
      <div className={`flex justify-between text-base font-bold ${Math.abs(remaining) > 0.01 ? 'text-red-800 dark:text-red-300' : ''}`}>
        <span>{t('expenses.unallocated')}</span>
        <span>{formatCurrency(remaining)}</span>
      </div>
    </fieldset>
  );
}

export function buildTargets(
  selected: string[],
  farms: Array<{ id: string; acre_equivalent: number }>,
  manualAmounts: Record<string, string>,
) {
  return selected.map((farmId) => ({
    farmId,
    acres: safeNumber(farms.find((f) => f.id === farmId)?.acre_equivalent),
    amount: safeNumber(manualAmounts[farmId]),
  }));
}
