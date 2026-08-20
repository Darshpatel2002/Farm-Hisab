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
import { seedSchema } from '../lib/validation/schemas';
import { today, formatDate } from '../lib/formatting/date';
import { currencySymbol, formatCurrency, formatNumber, round, safeNumber } from '../lib/formatting/number';
import type { SeedRecord } from '../types/db';

export default function SeedsPage() {
  const { t } = useTranslation();
  const { seasonId, farmById, cropName } = useAppData();
  const { recent, remember } = useRecent('seed', { farm_id: '', unit: 'kg', supplier: '' });

  const query = useRecords(
    'seed_records',
    { match: { season_id: seasonId ?? undefined }, orderBy: { column: 'date', ascending: false } },
    Boolean(seasonId),
  );
  const save = useSaveRecord('seed_records');
  const remove = useDeleteRecord('seed_records');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SeedRecord | null>(null);

  const defaults = useMemo(
    () => ({
      season_id: seasonId ?? '',
      farm_id: recent.farm_id,
      allocation_id: '',
      crop_id: '',
      date: today(),
      variety: '',
      quantity: '',
      unit: recent.unit,
      price_per_unit: '',
      supplier: recent.supplier,
      notes: '',
    }),
    [seasonId, recent],
  );

  const form = useZodForm(seedSchema, defaults);
  const totalCost = round(safeNumber(form.values.quantity) * safeNumber(form.values.price_per_unit), 2);

  const openForm = (row: SeedRecord | null) => {
    setEditing(row);
    form.reset(
      row
        ? {
            season_id: row.season_id,
            farm_id: row.farm_id,
            allocation_id: row.allocation_id ?? '',
            crop_id: row.crop_id ?? '',
            date: row.date,
            variety: row.variety,
            quantity: String(row.quantity),
            unit: row.unit,
            price_per_unit: String(row.price_per_unit),
            supplier: row.supplier ?? '',
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
        crop_id: data.crop_id || null,
        date: data.date,
        variety: data.variety,
        quantity: data.quantity,
        unit: data.unit,
        price_per_unit: data.price_per_unit,
        supplier: data.supplier || null,
        notes: data.notes || null,
      },
    });
    remember({ farm_id: data.farm_id, unit: data.unit, supplier: data.supplier ?? '' });
    setOpen(false);
  };

  if (!seasonId) return <NoSeasonNotice />;

  return (
    <RecordScreen<SeedRecord>
      title={t('seeds.title')}
      addLabel={t('seeds.add')}
      emptyMessage={t('seeds.empty')}
      emptyActionLabel={t('seeds.emptyAction')}
      records={query.data ?? []}
      loading={query.isLoading}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(row) => remove.mutateAsync(row.id)}
      deleteMessage={() => t('seeds.deleteConfirm')}
      renderItem={(row) => (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">{row.variety}</h3>
            <span className="text-base font-semibold">{formatCurrency(row.total_cost)}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatDate(row.date)} · {farmById.get(row.farm_id)?.name ?? ''} {cropName(row.crop_id)}
          </p>
          <RecordLine label={t('common.quantity')} value={`${formatNumber(row.quantity, 2)} ${row.unit}`} />
          <RecordLine label={t('seeds.pricePerUnit')} value={formatCurrency(row.price_per_unit)} />
          {row.supplier ? <RecordLine label={t('seeds.supplier')} value={row.supplier} /> : null}
        </div>
      )}
    >
      <Modal
        open={open}
        title={editing ? t('seeds.edit') : t('seeds.add')}
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
          onChange={(value, allocation) => {
            form.setField('allocation_id', value);
            if (allocation) form.setField('crop_id', allocation.crop_id);
          }}
        />
        <DateField value={str(form.values, 'date')} error={form.errors.date} required onChange={(v) => form.setField('date', v)} />
        <TextField
          label={t('seeds.variety')}
          required
          value={str(form.values, 'variety')}
          error={form.errors.variety}
          onChange={(e) => form.setField('variety', e.target.value)}
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
        <NumberField
          label={t('seeds.pricePerUnit')}
          required
          prefix={currencySymbol()}
          value={str(form.values, 'price_per_unit')}
          error={form.errors.price_per_unit}
          onChange={(e) => form.setField('price_per_unit', e.target.value)}
        />
        <p className="mb-3 text-lg font-bold">
          {t('common.totalCost')}: {formatCurrency(totalCost)}
        </p>
        <TextField
          label={t('seeds.supplier')}
          value={str(form.values, 'supplier')}
          error={form.errors.supplier}
          onChange={(e) => form.setField('supplier', e.target.value)}
        />
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
