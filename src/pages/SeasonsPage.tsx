import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RecordScreen, RecordLine } from '../components/records/RecordScreen';
import { Badge } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { SelectField, TextAreaField, TextField, NumberField } from '../components/ui/Field';
import { enumOptions } from '../components/records/Selectors';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { useSeasonReport } from '../features/reports/useSeasonReport';
import { useZodForm, str } from '../features/common/useZodForm';
import { useAuth } from '../hooks/useAuth';
import { seasonSchema } from '../lib/validation/schemas';
import { formatCurrency, formatNumber } from '../lib/formatting/number';
import { formatDate } from '../lib/formatting/date';
import type { Season } from '../types/db';

const STATUSES = ['planned', 'active', 'completed'] as const;

export default function SeasonsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const seasonsQuery = useRecords('seasons', { orderBy: { column: 'year', ascending: false } });
  const save = useSaveRecord('seasons');
  const remove = useDeleteRecord('seasons');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [closing, setClosing] = useState<Season | null>(null);

  const defaults = useMemo(
    () => ({
      name: `${new Date().getFullYear()} Kharif`,
      year: String(new Date().getFullYear()),
      start_date: '',
      end_date: '',
      status: 'active',
      notes: '',
    }),
    [],
  );

  const form = useZodForm(seasonSchema, defaults);
  const { report } = useSeasonReport(closing?.id ?? null);

  const openForm = (season: Season | null) => {
    setEditing(season);
    form.reset(
      season
        ? {
            name: season.name,
            year: String(season.year),
            start_date: season.start_date ?? '',
            end_date: season.end_date ?? '',
            status: season.status,
            notes: season.notes ?? '',
          }
        : defaults,
    );
    setOpen(true);
  };

  const submit = async () => {
    const result = form.validate();
    if (!result.success) return;
    await save.mutateAsync({
      id: editing?.id,
      baseUpdatedAt: editing?.updated_at,
      values: {
        name: result.data.name,
        year: result.data.year,
        start_date: result.data.start_date,
        end_date: result.data.end_date,
        status: result.data.status,
        notes: result.data.notes || null,
      },
    });
    setOpen(false);
  };

  const closeSeason = async () => {
    if (!closing) return;
    await save.mutateAsync({
      id: closing.id,
      baseUpdatedAt: closing.updated_at,
      values: { status: 'completed', closed_at: new Date().toISOString() },
    });
    setClosing(null);
  };

  return (
    <RecordScreen<Season>
      title={t('seasons.title')}
      addLabel={t('seasons.add')}
      emptyMessage={t('seasons.empty')}
      emptyActionLabel={t('seasons.emptyAction')}
      records={seasonsQuery.data ?? []}
      loading={seasonsQuery.isLoading}
      canEdit={isAdmin}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(season) => remove.mutateAsync(season.id)}
      deleteMessage={(season) => t('seasons.deleteConfirm', { name: season.name })}
      renderItem={(season) => (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold">{season.name}</h3>
            <Badge tone={season.status === 'active' ? 'good' : season.status === 'completed' ? 'info' : 'neutral'}>
              {t(`seasonStatus.${season.status}`)}
            </Badge>
          </div>
          <RecordLine label={t('seasons.year')} value={season.year} />
          <RecordLine
            label={`${t('seasons.startDate')} - ${t('seasons.endDate')}`}
            value={`${formatDate(season.start_date)} - ${formatDate(season.end_date)}`}
          />
          {isAdmin && season.status !== 'completed' ? (
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setClosing(season)}>
              {t('seasons.close')}
            </Button>
          ) : null}
        </div>
      )}
    >
      <Modal
        open={open}
        title={editing ? t('seasons.edit') : t('seasons.add')}
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
        <TextField
          label={t('seasons.name')}
          required
          value={str(form.values, 'name')}
          error={form.errors.name}
          onChange={(e) => form.setField('name', e.target.value)}
        />
        <NumberField
          label={t('seasons.year')}
          required
          step="1"
          value={str(form.values, 'year')}
          error={form.errors.year}
          onChange={(e) => form.setField('year', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('seasons.startDate')}
            type="date"
            value={str(form.values, 'start_date')}
            error={form.errors.start_date}
            onChange={(e) => form.setField('start_date', e.target.value)}
          />
          <TextField
            label={t('seasons.endDate')}
            type="date"
            value={str(form.values, 'end_date')}
            error={form.errors.end_date}
            onChange={(e) => form.setField('end_date', e.target.value)}
          />
        </div>
        <SelectField
          label={t('common.status')}
          value={str(form.values, 'status')}
          error={form.errors.status}
          options={enumOptions(t, 'seasonStatus', STATUSES)}
          onChange={(e) => form.setField('status', e.target.value)}
        />
        <TextAreaField
          label={t('common.notes')}
          value={str(form.values, 'notes')}
          error={form.errors.notes}
          onChange={(e) => form.setField('notes', e.target.value)}
        />
      </Modal>

      <ConfirmDialog
        open={closing !== null}
        title={t('seasons.summaryTitle')}
        danger={false}
        confirmLabel={t('seasons.close')}
        busy={save.isPending}
        onCancel={() => setClosing(null)}
        onConfirm={() => void closeSeason()}
        message={[
          t('seasons.closeConfirm', { name: closing?.name ?? '' }),
          `${t('dashboard.totalArea')}: ${formatNumber(report.totals.acres, 2)} ${t('common.acres')}`,
          `${t('dashboard.totalInvestment')}: ${formatCurrency(report.totals.cost)}`,
          `${t('dashboard.totalRevenue')}: ${formatCurrency(report.totals.revenue)}`,
          `${t('dashboard.netProfit')}: ${formatCurrency(report.totals.profit)}`,
          `${t('reports.roiShort')}: ${formatNumber(report.totals.roi, 1)}%`,
        ].join('\n')}
      />
    </RecordScreen>
  );
}
