import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoSeasonNotice, RecordLine, RecordScreen } from '../components/records/RecordScreen';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { AllocationField, DateField, FarmField, enumOptions } from '../components/records/Selectors';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { useZodForm, str } from '../features/common/useZodForm';
import { useRecent } from '../hooks/usePreferences';
import { useAppData } from '../hooks/useAppData';
import { activitySchema } from '../lib/validation/schemas';
import { today, formatDate } from '../lib/formatting/date';
import { formatCurrency, formatNumber, currencySymbol } from '../lib/formatting/number';
import { ACTIVITY_TYPES, type Activity } from '../types/db';

export default function ActivitiesPage() {
  const { t } = useTranslation();
  const { seasonId, farmById } = useAppData();
  const { recent, remember } = useRecent('activity', { farm_id: '', activity_type: 'labour', vendor: '' });

  const query = useRecords(
    'activities',
    { match: { season_id: seasonId ?? undefined }, orderBy: { column: 'date', ascending: false } },
    Boolean(seasonId),
  );
  const save = useSaveRecord('activities');
  const remove = useDeleteRecord('activities');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const defaults = useMemo(
    () => ({
      season_id: seasonId ?? '',
      farm_id: recent.farm_id,
      allocation_id: '',
      date: today(),
      activity_type: recent.activity_type,
      description: '',
      quantity: '',
      unit: '',
      cost: '',
      labour_days: '',
      tractor_hours: '',
      vendor: recent.vendor,
      notes: '',
    }),
    [seasonId, recent],
  );

  const form = useZodForm(activitySchema, defaults);

  const openForm = (activity: Activity | null) => {
    setEditing(activity);
    form.reset(
      activity
        ? {
            season_id: activity.season_id,
            farm_id: activity.farm_id,
            allocation_id: activity.allocation_id ?? '',
            date: activity.date,
            activity_type: activity.activity_type,
            description: activity.description,
            quantity: activity.quantity ?? '',
            unit: activity.unit ?? '',
            cost: String(activity.cost),
            labour_days: activity.labour_days ?? '',
            tractor_hours: activity.tractor_hours ?? '',
            vendor: activity.vendor ?? '',
            notes: activity.notes ?? '',
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
        activity_type: data.activity_type,
        description: data.description ?? '',
        quantity: data.quantity,
        unit: data.unit || null,
        cost: data.cost,
        labour_days: data.labour_days,
        tractor_hours: data.tractor_hours,
        vendor: data.vendor || null,
        notes: data.notes || null,
      },
    });
    remember({ farm_id: data.farm_id, activity_type: data.activity_type, vendor: data.vendor ?? '' });
    setOpen(false);
  };

  if (!seasonId) return <NoSeasonNotice />;

  return (
    <RecordScreen<Activity>
      title={t('activities.title')}
      addLabel={t('activities.add')}
      emptyMessage={t('activities.empty')}
      emptyActionLabel={t('activities.emptyAction')}
      records={query.data ?? []}
      loading={query.isLoading}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(row) => remove.mutateAsync(row.id)}
      deleteMessage={() => t('activities.deleteConfirm')}
      renderItem={(row) => (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">{t(`activityTypes.${row.activity_type}`)}</h3>
            <span className="text-base font-semibold">{formatCurrency(row.cost)}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatDate(row.date)} · {farmById.get(row.farm_id)?.name ?? ''}
          </p>
          {row.description ? <p className="mt-1 text-base">{row.description}</p> : null}
          {row.labour_days ? <RecordLine label={t('activities.labourDays')} value={formatNumber(row.labour_days, 1)} /> : null}
          {row.tractor_hours ? (
            <RecordLine label={t('activities.tractorHours')} value={formatNumber(row.tractor_hours, 1)} />
          ) : null}
        </div>
      )}
    >
      <Modal
        open={open}
        title={editing ? t('activities.edit') : t('activities.add')}
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
        <SelectField
          label={t('activities.type')}
          required
          value={str(form.values, 'activity_type')}
          error={form.errors.activity_type}
          options={enumOptions(t, 'activityTypes', ACTIVITY_TYPES)}
          onChange={(e) => form.setField('activity_type', e.target.value)}
        />
        <TextField
          label={t('common.description')}
          value={str(form.values, 'description')}
          error={form.errors.description}
          onChange={(e) => form.setField('description', e.target.value)}
        />
        <NumberField
          label={t('common.cost')}
          required
          prefix={currencySymbol()}
          value={str(form.values, 'cost')}
          error={form.errors.cost}
          onChange={(e) => form.setField('cost', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('activities.labourDays')}
            value={str(form.values, 'labour_days')}
            error={form.errors.labour_days}
            onChange={(e) => form.setField('labour_days', e.target.value)}
          />
          <NumberField
            label={t('activities.tractorHours')}
            value={str(form.values, 'tractor_hours')}
            error={form.errors.tractor_hours}
            onChange={(e) => form.setField('tractor_hours', e.target.value)}
          />
        </div>
        <TextField
          label={t('common.vendor')}
          value={str(form.values, 'vendor')}
          error={form.errors.vendor}
          onChange={(e) => form.setField('vendor', e.target.value)}
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
