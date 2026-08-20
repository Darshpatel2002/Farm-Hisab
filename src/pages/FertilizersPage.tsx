import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoSeasonNotice, RecordLine, RecordScreen } from '../components/records/RecordScreen';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { NumberField, TextAreaField, TextField } from '../components/ui/Field';
import { AllocationField, DateField, FarmField, UnitField } from '../components/records/Selectors';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { useZodForm, str } from '../features/common/useZodForm';
import { useRecent } from '../hooks/usePreferences';
import { useAppData } from '../hooks/useAppData';
import { fertilizerSchema } from '../lib/validation/schemas';
import { today, formatDate } from '../lib/formatting/date';
import { currencySymbol, formatCurrency, formatNumber, round, safeNumber } from '../lib/formatting/number';
import type { FertilizerRecord } from '../types/db';

export default function FertilizersPage() {
  const { t } = useTranslation();
  const { seasonId, farmById } = useAppData();
  const { recent, remember } = useRecent('fertilizer', { farm_id: '', product_name: '', unit: 'kg' });

  const query = useRecords(
    'fertilizer_records',
    { match: { season_id: seasonId ?? undefined }, orderBy: { column: 'date', ascending: false } },
    Boolean(seasonId),
  );
  const save = useSaveRecord('fertilizer_records');
  const remove = useDeleteRecord('fertilizer_records');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FertilizerRecord | null>(null);

  const defaults = useMemo(
    () => ({
      season_id: seasonId ?? '',
      farm_id: recent.farm_id,
      allocation_id: '',
      date: today(),
      product_name: recent.product_name,
      quantity: '',
      unit: recent.unit,
      rate: '',
      labour_cost: '0',
      notes: '',
    }),
    [seasonId, recent],
  );

  const form = useZodForm(fertilizerSchema, defaults);
  const materialCost = round(safeNumber(form.values.quantity) * safeNumber(form.values.rate), 2);
  const totalCost = round(materialCost + safeNumber(form.values.labour_cost), 2);

  const openForm = (row: FertilizerRecord | null) => {
    setEditing(row);
    form.reset(
      row
        ? {
            season_id: row.season_id,
            farm_id: row.farm_id,
            allocation_id: row.allocation_id ?? '',
            date: row.date,
            product_name: row.product_name,
            quantity: String(row.quantity),
            unit: row.unit,
            rate: String(row.rate),
            labour_cost: String(row.labour_cost),
            notes: row.notes ?? '',
          }
        : defaults,
    );
    setOpen(true);
  };

  const submit = async () => {
    const result = form.validate();
    if (!result.success) return;
    const data = result.data;
    await save.mutateAsync({
      id: editing?.id,
      baseUpdatedAt: editing?.updated_at,
      values: {
        season_id: data.season_id,
        farm_id: data.farm_id,
        allocation_id: data.allocation_id || null,
        date: data.date,
        product_name: data.product_name,
        quantity: data.quantity,
        unit: data.unit,
        rate: data.rate,
        material_cost: round(Number(data.quantity) * Number(data.rate), 2),
        labour_cost: data.labour_cost,
        notes: data.notes || null,
      },
    });
    remember({ farm_id: data.farm_id, product_name: data.product_name, unit: data.unit });
    setOpen(false);
  };

  if (!seasonId) return <NoSeasonNotice />;

  return (
    <RecordScreen<FertilizerRecord>
      title={t('fertilizers.title')}
      addLabel={t('fertilizers.add')}
      emptyMessage={t('fertilizers.empty')}
      emptyActionLabel={t('fertilizers.emptyAction')}
      records={query.data ?? []}
      loading={query.isLoading}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(row) => remove.mutateAsync(row.id)}
      deleteMessage={() => t('fertilizers.deleteConfirm')}
      renderItem={(row) => (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">{row.product_name}</h3>
            <span className="text-base font-semibold">{formatCurrency(row.total_cost)}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatDate(row.date)} · {farmById.get(row.farm_id)?.name ?? ''}
          </p>
          <RecordLine label={t('common.quantity')} value={`${formatNumber(row.quantity, 2)} ${row.unit}`} />
          <RecordLine label={t('common.labourCost')} value={formatCurrency(row.labour_cost)} />
        </div>
      )}
    >
      <Modal
        open={open}
        title={editing ? t('fertilizers.edit') : t('fertilizers.add')}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button fullWidth loading={save.isPending} onClick={() => void submit()}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      >
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
          onChange={(value) => form.setField('allocation_id', value)}
        />
        <DateField value={str(form.values, 'date')} error={form.errors.date} required onChange={(v) => form.setField('date', v)} />
        <TextField
          label={t('fertilizers.product')}
          required
          value={str(form.values, 'product_name')}
          error={form.errors.product_name}
          onChange={(e) => form.setField('product_name', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('common.quantity')}
            required
            value={str(form.values, 'quantity')}
            error={form.errors.quantity}
            onChange={(e) => form.setField('quantity', e.target.value)}
          />
          <UnitField
            kind="weight"
            value={str(form.values, 'unit')}
            error={form.errors.unit}
            onChange={(value) => form.setField('unit', value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('common.rate')}
            required
            prefix={currencySymbol()}
            value={str(form.values, 'rate')}
            error={form.errors.rate}
            onChange={(e) => form.setField('rate', e.target.value)}
          />
          <NumberField
            label={t('common.labourCost')}
            prefix={currencySymbol()}
            value={str(form.values, 'labour_cost')}
            error={form.errors.labour_cost}
            onChange={(e) => form.setField('labour_cost', e.target.value)}
          />
        </div>
        <p className="mb-3 text-lg font-bold">
          {t('common.totalCost')}: {formatCurrency(totalCost)}
        </p>
        <TextAreaField
          label={t('common.notes')}
          value={str(form.values, 'notes')}
          error={form.errors.notes}
          onChange={(e) => form.setField('notes', e.target.value)}
        />
      </Modal>
    </RecordScreen>
  );
}
