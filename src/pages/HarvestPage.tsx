import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoSeasonNotice, RecordLine, RecordScreen } from '../components/records/RecordScreen';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { NumberField, SelectField, TextAreaField } from '../components/ui/Field';
import { AllocationField, DateField, FarmField, UnitField, enumOptions } from '../components/records/Selectors';
import { PhotoField, PhotoThumb } from '../components/records/PhotoField';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { useZodForm, str } from '../features/common/useZodForm';
import { useRecent } from '../hooks/usePreferences';
import { useAppData } from '../hooks/useAppData';
import { harvestSchema } from '../lib/validation/schemas';
import { today, formatDate } from '../lib/formatting/date';
import { currencySymbol, formatCurrency, formatNumber, round, safeNumber } from '../lib/formatting/number';
import type { Harvest } from '../types/db';

const QUALITIES = ['a', 'b', 'c', 'mixed'] as const;

export default function HarvestPage() {
  const { t } = useTranslation();
  const { seasonId, farmById, cropName, settings } = useAppData();
  const { recent, remember } = useRecent('harvest', { farm_id: '', unit: 'quintal' });

  const query = useRecords(
    'harvests',
    { match: { season_id: seasonId ?? undefined }, orderBy: { column: 'start_date', ascending: false } },
    Boolean(seasonId),
  );
  const save = useSaveRecord('harvests');
  const remove = useDeleteRecord('harvests');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Harvest | null>(null);

  const defaults = useMemo(
    () => ({
      season_id: seasonId ?? '',
      farm_id: recent.farm_id,
      allocation_id: '',
      crop_id: '',
      start_date: today(),
      end_date: '',
      quantity: '',
      unit: recent.unit || settings?.default_weight_unit || 'quintal',
      quality: 'a',
      wastage: '0',
      labour_cost: '0',
      harvest_cost: '0',
      transport_cost: '0',
      notes: '',
      photo_url: '',
    }),
    [seasonId, recent, settings?.default_weight_unit],
  );

  const form = useZodForm(harvestSchema, defaults);
  const netQuantity = round(Math.max(safeNumber(form.values.quantity) - safeNumber(form.values.wastage), 0), 3);

  const openForm = (row: Harvest | null) => {
    setEditing(row);
    form.reset(
      row
        ? {
            season_id: row.season_id,
            farm_id: row.farm_id,
            allocation_id: row.allocation_id ?? '',
            crop_id: row.crop_id ?? '',
            start_date: row.start_date,
            end_date: row.end_date ?? '',
            quantity: String(row.quantity),
            unit: row.unit,
            quality: row.quality,
            wastage: String(row.wastage),
            labour_cost: String(row.labour_cost),
            harvest_cost: String(row.harvest_cost),
            transport_cost: String(row.transport_cost),
            notes: row.notes ?? '',
            photo_url: row.photo_url ?? '',
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
        start_date: data.start_date,
        end_date: data.end_date,
        quantity: data.quantity,
        unit: data.unit,
        quality: data.quality,
        wastage: data.wastage,
        labour_cost: data.labour_cost,
        harvest_cost: data.harvest_cost,
        transport_cost: data.transport_cost,
        notes: data.notes || null,
        photo_url: data.photo_url || null,
      },
    });
    remember({ farm_id: data.farm_id, unit: data.unit });
    setOpen(false);
  };

  if (!seasonId) return <NoSeasonNotice />;

  return (
    <RecordScreen<Harvest>
      title={t('harvest.title')}
      addLabel={t('harvest.add')}
      emptyMessage={t('harvest.empty')}
      emptyActionLabel={t('harvest.emptyAction')}
      records={query.data ?? []}
      loading={query.isLoading}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(row) => remove.mutateAsync(row.id)}
      deleteMessage={(row) => t('harvest.deleteConfirm', { quantity: `${formatNumber(row.quantity, 2)} ${row.unit}` })}
      renderItem={(row) => (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">{cropName(row.crop_id) || t('harvest.title')}</h3>
            <span className="text-base font-semibold">
              {formatNumber(row.net_quantity, 2)} {row.unit}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatDate(row.start_date)} · {farmById.get(row.farm_id)?.name ?? ''}
          </p>
          <RecordLine label={t('common.quantity')} value={`${formatNumber(row.quantity, 2)} ${row.unit}`} />
          <RecordLine label={t('harvest.wastage')} value={`${formatNumber(row.wastage, 2)} ${row.unit}`} />
          <RecordLine label={t('harvest.quality')} value={t(`quality.${row.quality}`)} />
          <RecordLine label={t('common.totalCost')} value={formatCurrency(row.total_cost)} />
          {row.photo_url ? <PhotoThumb url={row.photo_url} /> : null}
        </div>
      )}
    >
      <Modal
        open={open}
        title={editing ? t('harvest.edit') : t('harvest.add')}
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
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label={t('harvest.startDate')}
            value={str(form.values, 'start_date')}
            error={form.errors.start_date}
            required
            onChange={(v) => form.setField('start_date', v)}
          />
          <DateField
            label={t('harvest.endDate')}
            value={str(form.values, 'end_date')}
            error={form.errors.end_date}
            onChange={(v) => form.setField('end_date', v)}
          />
        </div>
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
            label={t('harvest.wastage')}
            value={str(form.values, 'wastage')}
            error={form.errors.wastage}
            onChange={(e) => form.setField('wastage', e.target.value)}
          />
          <SelectField
            label={t('harvest.quality')}
            value={str(form.values, 'quality')}
            error={form.errors.quality}
            options={enumOptions(t, 'quality', QUALITIES)}
            onChange={(e) => form.setField('quality', e.target.value)}
          />
        </div>
        <p className="mb-3 text-lg font-bold">
          {t('harvest.netQuantity')}: {formatNumber(netQuantity, 2)} {str(form.values, 'unit')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('common.labourCost')}
            prefix={currencySymbol()}
            value={str(form.values, 'labour_cost')}
            error={form.errors.labour_cost}
            onChange={(e) => form.setField('labour_cost', e.target.value)}
          />
          <NumberField
            label={t('harvest.harvestCost')}
            prefix={currencySymbol()}
            value={str(form.values, 'harvest_cost')}
            error={form.errors.harvest_cost}
            onChange={(e) => form.setField('harvest_cost', e.target.value)}
          />
        </div>
        <NumberField
          label={t('common.transportCost')}
          prefix={currencySymbol()}
          value={str(form.values, 'transport_cost')}
          error={form.errors.transport_cost}
          onChange={(e) => form.setField('transport_cost', e.target.value)}
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
