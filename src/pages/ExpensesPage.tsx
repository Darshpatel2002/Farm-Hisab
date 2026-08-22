import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoSeasonNotice, RecordLine, RecordScreen } from '../components/records/RecordScreen';
import { Badge, Card } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { AllocationField, CropField, DateField, FarmField, enumOptions } from '../components/records/Selectors';
import { PhotoField, PhotoThumb } from '../components/records/PhotoField';
import { FarmSplit, buildTargets } from '../components/records/FarmSplit';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { loadExpenseAllocations, replaceExpenseAllocations } from '../features/expenses/allocationApi';
import { useZodForm, str } from '../features/common/useZodForm';
import { useRecent } from '../hooks/usePreferences';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { expenseSchema } from '../lib/validation/schemas';
import { toAppError } from '../lib/errors';
import { allocateExpense, isFullyAllocated } from '../lib/calculations/allocation';
import { today, formatDate } from '../lib/formatting/date';
import { currencySymbol, formatCurrency, safeNumber } from '../lib/formatting/number';
import { EXPENSE_CATEGORIES, type Expense, type ExpenseAllocation } from '../types/db';

const PAYMENT_METHODS = ['cash', 'upi', 'bank', 'credit', 'other'] as const;
const METHODS = [
  { value: 'direct', labelKey: 'expenses.methodDirect' },
  { value: 'manual', labelKey: 'expenses.methodManual' },
  { value: 'area', labelKey: 'expenses.methodArea' },
  { value: 'equal', labelKey: 'expenses.methodEqual' },
] as const;

export default function ExpensesPage() {
  const { t } = useTranslation();
  const { seasonId, farms, farmById, cropName, settings } = useAppData();
  const { profile } = useAuth();
  const toast = useToast();
  const { recent, remember } = useRecent('expense', { farm_id: '', category: 'other', vendor: '' });

  const [categoryFilter, setCategoryFilter] = useState('');
  const [farmFilter, setFarmFilter] = useState('');

  const query = useRecords(
    'expenses',
    {
      match: {
        season_id: seasonId ?? undefined,
        category: categoryFilter || undefined,
        farm_id: farmFilter || undefined,
      },
      orderBy: { column: 'date', ascending: false },
    },
    Boolean(seasonId),
  );
  const save = useSaveRecord('expenses');
  const remove = useDeleteRecord('expenses');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [splitFarms, setSplitFarms] = useState<string[]>([]);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});

  const defaults = useMemo(
    () => ({
      season_id: seasonId ?? '',
      date: today(),
      category: recent.category,
      description: '',
      amount: '',
      allocation_method: 'direct',
      farm_id: recent.farm_id,
      allocation_id: '',
      crop_id: '',
      vendor: recent.vendor,
      quantity: '',
      unit: '',
      payment_method: 'cash',
      notes: '',
      photo_url: '',
      allocations: [],
    }),
    [seasonId, recent],
  );

  const form = useZodForm(expenseSchema, defaults);
  const method = str(form.values, 'allocation_method');
  const amount = safeNumber(form.values.amount);

  const openForm = async (expense: Expense | null) => {
    setEditing(expense);
    setSplitFarms([]);
    setManualAmounts({});
    if (expense) {
      form.reset({
        season_id: expense.season_id,
        date: expense.date,
        category: expense.category,
        description: expense.description,
        amount: String(expense.amount),
        allocation_method: expense.allocation_method,
        farm_id: expense.farm_id ?? '',
        allocation_id: expense.allocation_id ?? '',
        crop_id: expense.crop_id ?? '',
        vendor: expense.vendor ?? '',
        quantity: expense.quantity ?? '',
        unit: expense.unit ?? '',
        payment_method: expense.payment_method,
        notes: expense.notes ?? '',
        photo_url: expense.photo_url ?? '',
        allocations: [],
      });
      if (expense.allocation_method !== 'direct') {
        try {
          const lines = (await loadExpenseAllocations(expense.id)) as ExpenseAllocation[];
          setSplitFarms(lines.map((l) => l.farm_id));
          setManualAmounts(Object.fromEntries(lines.map((l) => [l.farm_id, String(l.amount)])));
        } catch (error) {
          toast.error(t(toAppError(error).messageKey));
        }
      }
    } else {
      form.reset(defaults);
    }
    setOpen(true);
  };

  const submit = async () => {
    const basis = method === 'direct' ? null : (method as 'manual' | 'area' | 'equal');
    const targets = buildTargets(splitFarms, farms, manualAmounts);
    const previewLines = basis ? allocateExpense(amount, targets, basis) : [];

    form.setField(
      'allocations',
      previewLines.map((line) => ({ farm_id: line.farmId, allocation_id: line.allocationId, amount: line.amount })),
    );

    const result = expenseSchema.safeParse({
      ...form.values,
      allocations: previewLines.map((line) => ({
        farm_id: line.farmId,
        allocation_id: line.allocationId,
        amount: line.amount,
      })),
    });
    if (!result.success) {
      form.validate();
      return;
    }
    const data = result.data;

    if (basis && settings?.require_full_allocation && !isFullyAllocated(amount, previewLines)) {
      toast.error(t('validation.allocationIncomplete'));
      return;
    }

    const saved = await save.mutateAsync({
      id: editing?.id,
      baseUpdatedAt: editing?.updated_at,
      values: {
        season_id: data.season_id,
        date: data.date,
        category: data.category,
        description: data.description ?? '',
        amount: data.amount,
        allocation_method: data.allocation_method,
        farm_id: data.allocation_method === 'direct' ? data.farm_id : null,
        allocation_id: data.allocation_method === 'direct' ? data.allocation_id || null : null,
        crop_id: data.crop_id || null,
        vendor: data.vendor || null,
        quantity: data.quantity,
        unit: data.unit || null,
        payment_method: data.payment_method,
        notes: data.notes || null,
        photo_url: data.photo_url || null,
      },
    });

    if (basis && profile) {
      try {
        await replaceExpenseAllocations({
          householdId: profile.household_id,
          expenseId: (saved as Expense).id,
          total: amount,
          targets,
          basis,
        });
      } catch (error) {
        toast.error(t(toAppError(error).messageKey));
      }
    }

    remember({ farm_id: data.farm_id ?? '', category: data.category, vendor: data.vendor ?? '' });
    setOpen(false);
  };

  if (!seasonId) return <NoSeasonNotice />;

  const expenses = query.data ?? [];
  const total = expenses.reduce((sum, e) => sum + safeNumber(e.amount), 0);

  return (
    <RecordScreen<Expense>
      title={t('expenses.title')}
      subtitle={`${t('common.total')}: ${formatCurrency(total)}`}
      addLabel={t('expenses.add')}
      emptyMessage={t('expenses.empty')}
      emptyActionLabel={t('expenses.emptyAction')}
      records={expenses}
      loading={query.isLoading}
      onAdd={() => void openForm(null)}
      onEdit={(row) => void openForm(row)}
      onDelete={(row) => remove.mutateAsync(row.id)}
      deleteMessage={(row) => t('expenses.deleteConfirm', { amount: formatCurrency(row.amount) })}
      filters={
        <Card className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label={t('common.category')}
              value={categoryFilter}
              placeholder={t('common.all')}
              options={enumOptions(t, 'categories', EXPENSE_CATEGORIES)}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <SelectField
              label={t('common.farm')}
              value={farmFilter}
              placeholder={t('common.all')}
              options={farms.map((f) => ({ value: f.id, label: f.name }))}
              onChange={(e) => setFarmFilter(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCategoryFilter('');
              setFarmFilter('');
            }}
          >
            {t('common.reset')}
          </Button>
        </Card>
      }
      renderItem={(row) => (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">{t(`categories.${row.category}`)}</h3>
            <span className="text-lg font-bold">{formatCurrency(row.amount)}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatDate(row.date)} · {row.farm_id ? (farmById.get(row.farm_id)?.name ?? '') : t('expenses.sharedTitle')}
          </p>
          {row.description ? <p className="mt-1 text-base">{row.description}</p> : null}
          {row.crop_id ? <RecordLine label={t('common.crop')} value={cropName(row.crop_id)} /> : null}
          <RecordLine label={t('common.paymentMethod')} value={t(`paymentMethods.${row.payment_method}`)} />
          {row.source_type !== 'manual' ? (
            <p className="mt-2">
              <Badge tone="info">{t('expenses.linkedRecord', { source: t(`nav.${sourceNavKey(row.source_type)}`) })}</Badge>
            </p>
          ) : null}
          {row.photo_url ? <PhotoThumb url={row.photo_url} /> : null}
        </div>
      )}
    >
      <Modal
        open={open}
        title={editing ? t('expenses.edit') : t('expenses.add')}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              fullWidth
              loading={save.isPending}
              disabled={editing?.source_type !== undefined && editing.source_type !== 'manual'}
              onClick={() => void submit()}
            >
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        {editing && editing.source_type !== 'manual' ? (
          <p className="mb-3 rounded-xl bg-soil-100 p-3 text-base font-semibold text-soil-700">
            {t('expenses.linkedHelp')}
          </p>
        ) : null}

        <DateField value={str(form.values, 'date')} error={form.errors.date} required onChange={(v) => form.setField('date', v)} />
        <SelectField
          label={t('common.category')}
          required
          value={str(form.values, 'category')}
          error={form.errors.category}
          options={enumOptions(t, 'categories', EXPENSE_CATEGORIES)}
          onChange={(e) => form.setField('category', e.target.value)}
        />
        <NumberField
          label={t('common.amount')}
          required
          prefix={currencySymbol()}
          value={str(form.values, 'amount')}
          error={form.errors.amount}
          onChange={(e) => form.setField('amount', e.target.value)}
        />
        <TextField
          label={t('common.description')}
          value={str(form.values, 'description')}
          error={form.errors.description}
          onChange={(e) => form.setField('description', e.target.value)}
        />
        <SelectField
          label={t('expenses.allocationMethod')}
          value={method}
          error={form.errors.allocation_method}
          options={METHODS.map((m) => ({ value: m.value, label: t(m.labelKey) }))}
          onChange={(e) => form.setField('allocation_method', e.target.value)}
        />

        {method === 'direct' ? (
          <>
            <FarmField
              value={str(form.values, 'farm_id')}
              error={form.errors.farm_id}
              required
              onChange={(value) => {
                form.setField('farm_id', value);
                form.setField('allocation_id', '');
              }}
            />
            <AllocationField
              seasonId={seasonId}
              farmId={str(form.values, 'farm_id')}
              value={str(form.values, 'allocation_id')}
              error={form.errors.allocation_id}
              onChange={(value, allocation) => {
                form.setField('allocation_id', value);
                if (allocation) form.setField('crop_id', allocation.crop_id);
              }}
            />
          </>
        ) : (
          <>
            <CropField
              value={str(form.values, 'crop_id')}
              error={form.errors.crop_id}
              includeAll
              onChange={(value) => form.setField('crop_id', value)}
            />
            <FarmSplit
              total={amount}
              basis={method as 'manual' | 'area' | 'equal'}
              selected={splitFarms}
              manualAmounts={manualAmounts}
              onToggleFarm={(farmId, checked) =>
                setSplitFarms((current) => (checked ? [...current, farmId] : current.filter((id) => id !== farmId)))
              }
              onManualChange={(farmId, value) => setManualAmounts((current) => ({ ...current, [farmId]: value }))}
            />
            {form.errors.allocations ? (
              <p role="alert" className="mb-3 text-sm font-semibold text-red-700">
                {t(form.errors.allocations)}
              </p>
            ) : null}
          </>
        )}

        <TextField
          label={t('common.vendor')}
          value={str(form.values, 'vendor')}
          error={form.errors.vendor}
          onChange={(e) => form.setField('vendor', e.target.value)}
        />
        <SelectField
          label={t('common.paymentMethod')}
          value={str(form.values, 'payment_method')}
          error={form.errors.payment_method}
          options={enumOptions(t, 'paymentMethods', PAYMENT_METHODS)}
          onChange={(e) => form.setField('payment_method', e.target.value)}
        />
        <TextAreaField
          label={t('common.notes')}
          value={str(form.values, 'notes')}
          error={form.errors.notes}
          onChange={(e) => form.setField('notes', e.target.value)}
        />
        <PhotoField value={str(form.values, 'photo_url')} onChange={(url) => form.setField('photo_url', url)} />
      </Modal>
    </RecordScreen>
  );
}

function sourceNavKey(source: string): string {
  switch (source) {
    case 'spray':
      return 'sprays';
    case 'irrigation':
      return 'irrigation';
    case 'fertilizer':
      return 'fertilizers';
    case 'seed':
      return 'seeds';
    case 'harvest':
      return 'harvest';
    case 'activity':
      return 'activities';
    default:
      return 'expenses';
  }
}
