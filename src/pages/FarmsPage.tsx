import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RecordScreen, RecordLine } from '../components/records/RecordScreen';
import { Badge, TrendValue } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CheckboxField, TextAreaField, TextField, NumberField } from '../components/ui/Field';
import { UnitField } from '../components/records/Selectors';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { useSeasonReport } from '../features/reports/useSeasonReport';
import { useZodForm, str, bool } from '../features/common/useZodForm';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../hooks/useAuth';
import { farmSchema } from '../lib/validation/schemas';
import { toAcres } from '../lib/calculations/units';
import { formatCurrency, formatNumber, safeNumber } from '../lib/formatting/number';
import type { Farm } from '../types/db';

export default function FarmsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { unitMap, settings, seasonId, cropName } = useAppData();
  const farmsQuery = useRecords('farms', { orderBy: { column: 'name' } });
  const save = useSaveRecord('farms');
  const remove = useDeleteRecord('farms');
  const { report } = useSeasonReport(seasonId);

  const [editing, setEditing] = useState<Farm | null>(null);
  const [open, setOpen] = useState(false);

  const defaults = useMemo(
    () => ({
      name: '',
      local_name: '',
      area: '',
      area_unit: settings?.default_area_unit ?? 'vigha',
      location_notes: '',
      is_active: true,
    }),
    [settings?.default_area_unit],
  );

  const form = useZodForm(farmSchema, defaults);
  const farms = farmsQuery.data ?? [];
  const metricsByFarm = useMemo(() => new Map(report.byFarm.map((f) => [f.farmId, f])), [report.byFarm]);

  const openForm = (farm: Farm | null) => {
    setEditing(farm);
    form.reset(
      farm
        ? {
            name: farm.name,
            local_name: farm.local_name,
            area: String(farm.area),
            area_unit: farm.area_unit,
            location_notes: farm.location_notes ?? '',
            is_active: farm.is_active,
          }
        : defaults,
    );
    setOpen(true);
  };

  const submit = async () => {
    const result = form.validate();
    if (!result.success) return;
    const values = result.data;
    await save.mutateAsync({
      id: editing?.id,
      baseUpdatedAt: editing?.updated_at,
      values: {
        name: values.name,
        local_name: values.local_name ?? '',
        area: values.area,
        area_unit: values.area_unit,
        acre_equivalent: toAcres(unitMap, values.area, values.area_unit),
        location_notes: values.location_notes || null,
        is_active: values.is_active,
      },
    });
    setOpen(false);
  };

  const previewAcres = toAcres(unitMap, safeNumber(form.values.area), str(form.values, 'area_unit'));

  return (
    <RecordScreen<Farm>
      title={t('farms.title')}
      addLabel={t('farms.add')}
      emptyMessage={t('farms.empty')}
      emptyActionLabel={t('farms.emptyAction')}
      records={farms}
      loading={farmsQuery.isLoading}
      canEdit={isAdmin}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(farm) => remove.mutateAsync(farm.id)}
      deleteMessage={(farm) => t('farms.deleteConfirm', { name: farm.name })}
      renderItem={(farm) => {
        const metrics = metricsByFarm.get(farm.id);
        const crops = metrics?.cropIds.map((id) => cropName(id)).filter(Boolean) ?? [];
        return (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link to={`/farms/${farm.id}`} className="text-lg font-bold text-brand-800 underline dark:text-brand-200">
                  {farm.name}
                </Link>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {formatNumber(farm.area, 2)} {farm.area_unit} · {formatNumber(farm.acre_equivalent, 2)}{' '}
                  {t('common.acres')}
                </p>
              </div>
              <Badge tone={farm.is_active ? 'good' : 'neutral'}>{farm.is_active ? t('farms.active') : t('farms.inactive')}</Badge>
            </div>

            <div className="mt-2">
              <RecordLine label={t('farms.currentCrop')} value={crops.length > 0 ? crops.join(', ') : t('common.noData')} />
              <RecordLine label={t('reports.cost')} value={formatCurrency(metrics?.cost ?? 0)} />
              <RecordLine label={t('reports.revenue')} value={formatCurrency(metrics?.revenue ?? 0)} />
              <RecordLine
                label={t('reports.profit')}
                value={<TrendValue value={metrics?.profit ?? 0} formatted={formatCurrency(metrics?.profit ?? 0)} />}
              />
              <RecordLine
                label={t('reports.profitPerAcre')}
                value={
                  <TrendValue
                    value={metrics?.profitPerAcre ?? 0}
                    formatted={formatCurrency(metrics?.profitPerAcre ?? 0)}
                  />
                }
              />
            </div>
          </div>
        );
      }}
    >
      <Modal
        open={open}
        title={editing ? t('farms.edit') : t('farms.add')}
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
          label={t('farms.name')}
          required
          value={str(form.values, 'name')}
          error={form.errors.name}
          onChange={(e) => form.setField('name', e.target.value)}
        />
        <TextField
          label={t('farms.localName')}
          value={str(form.values, 'local_name')}
          error={form.errors.local_name}
          onChange={(e) => form.setField('local_name', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('farms.area')}
            required
            value={str(form.values, 'area')}
            error={form.errors.area}
            onChange={(e) => form.setField('area', e.target.value)}
          />
          <UnitField
            kind="area"
            label={t('farms.areaUnit')}
            value={str(form.values, 'area_unit')}
            error={form.errors.area_unit}
            onChange={(value) => form.setField('area_unit', value)}
          />
        </div>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          {t('farms.acreEquivalent')}: <strong>{formatNumber(previewAcres, 3)}</strong> {t('common.acres')}
        </p>
        <TextAreaField
          label={t('farms.locationNotes')}
          value={str(form.values, 'location_notes')}
          error={form.errors.location_notes}
          onChange={(e) => form.setField('location_notes', e.target.value)}
        />
        <CheckboxField
          label={t('farms.active')}
          checked={bool(form.values, 'is_active')}
          onChange={(checked) => form.setField('is_active', checked)}
        />
      </Modal>
    </RecordScreen>
  );
}
