import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoSeasonNotice, RecordLine, RecordScreen } from '../components/records/RecordScreen';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { NumberField, SelectField, TextAreaField } from '../components/ui/Field';
import { AllocationField, DateField, FarmField, enumOptions } from '../components/records/Selectors';
import { PhotoField, PhotoThumb } from '../components/records/PhotoField';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { useZodForm, str } from '../features/common/useZodForm';
import { useRecent } from '../hooks/usePreferences';
import { useAppData } from '../hooks/useAppData';
import { irrigationSchema } from '../lib/validation/schemas';
import { today, formatDate } from '../lib/formatting/date';
import { currencySymbol, formatCurrency, formatNumber } from '../lib/formatting/number';
import type { IrrigationRecord } from '../types/db';

const WATER_SOURCES = ['borewell', 'canal', 'well', 'rain', 'other'] as const;

export default function IrrigationPage() {
  const { t } = useTranslation();
  const { seasonId, farmById } = useAppData();
  const { recent, remember } = useRecent('irrigation', { farm_id: '', water_source: 'borewell' });

  const query = useRecords(
    'irrigation_records',
    { match: { season_id: seasonId ?? undefined }, orderBy: { column: 'date', ascending: false } },
    Boolean(seasonId),
  );
  const save = useSaveRecord('irrigation_records');
  const remove = useDeleteRecord('irrigation_records');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IrrigationRecord | null>(null);

  const defaults = useMemo(
    () => ({
      season_id: seasonId ?? '',
      farm_id: recent.farm_id,
      allocation_id: '',
      date: today(),
      irrigation_number: '',
      water_source: recent.water_source,
      hours: '',
      cost: '',
      notes: '',
      photo_url: '',
    }),
    [seasonId, recent],
  );

  const form = useZodForm(irrigationSchema, defaults);

  const openForm = (row: IrrigationRecord | null) => {
    setEditing(row);
    form.reset(
      row
        ? {
            season_id: row.season_id,
            farm_id: row.farm_id,
            allocation_id: row.allocation_id ?? '',
            date: row.date,
            irrigation_number: row.irrigation_number ?? '',
            water_source: row.water_source,
            hours: row.hours ?? '',
            cost: String(row.cost),
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
        date: data.date,
        // Left empty, the database assigns the next number for this crop plan.
        irrigation_number: data.irrigation_number,
        water_source: data.water_source,
        hours: data.hours,
        cost: data.cost,
        notes: data.notes || null,
        photo_url: data.photo_url || null,
      },
    });
    remember({ farm_id: data.farm_id, water_source: data.water_source });
    setOpen(false);
  };

  if (!seasonId) return <NoSeasonNotice />;

  return (
    <RecordScreen<IrrigationRecord>
      title={t('irrigation.title')}
      addLabel={t('irrigation.add')}
      emptyMessage={t('irrigation.empty')}
      emptyActionLabel={t('irrigation.emptyAction')}
      records={query.data ?? []}
      loading={query.isLoading}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(row) => remove.mutateAsync(row.id)}
      deleteMessage={() => t('irrigation.deleteConfirm')}
      renderItem={(row) => (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">{t('irrigation.nth', { number: row.irrigation_number ?? '-' })}</h3>
            <span className="text-base font-semibold">{formatCurrency(row.cost)}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatDate(row.date)} · {farmById.get(row.farm_id)?.name ?? ''}
          </p>
          <RecordLine label={t('irrigation.waterSource')} value={t(`waterSources.${row.water_source}`)} />
          {row.hours ? <RecordLine label={t('irrigation.hours')} value={formatNumber(row.hours, 1)} /> : null}
          {row.photo_url ? <PhotoThumb url={row.photo_url} /> : null}
        </div>
      )}
    >
      <Modal
        open={open}
        title={editing ? t('irrigation.edit') : t('irrigation.add')}
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
        <NumberField
          label={t('irrigation.number')}
          hint={t('irrigation.numberAuto')}
          step="1"
          value={str(form.values, 'irrigation_number')}
          error={form.errors.irrigation_number}
          onChange={(e) => form.setField('irrigation_number', e.target.value)}
        />
        <SelectField
          label={t('irrigation.waterSource')}
          value={str(form.values, 'water_source')}
          error={form.errors.water_source}
          options={enumOptions(t, 'waterSources', WATER_SOURCES)}
          onChange={(e) => form.setField('water_source', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('irrigation.hours')}
            value={str(form.values, 'hours')}
            error={form.errors.hours}
            onChange={(e) => form.setField('hours', e.target.value)}
          />
          <NumberField
            label={t('common.cost')}
            required
            prefix={currencySymbol()}
            value={str(form.values, 'cost')}
            error={form.errors.cost}
            onChange={(e) => form.setField('cost', e.target.value)}
          />
        </div>
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
