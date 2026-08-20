import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RecordScreen, RecordLine } from '../components/records/RecordScreen';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { UnitField, enumOptions } from '../components/records/Selectors';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { useZodForm, str, bool } from '../features/common/useZodForm';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../hooks/useAppData';
import { useSeasonReport } from '../features/reports/useSeasonReport';
import { cropSchema } from '../lib/validation/schemas';
import { CROP_CATEGORIES, type Crop } from '../types/db';
import { formatCurrency, formatNumber } from '../lib/formatting/number';

export default function CropsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { settings, seasonId } = useAppData();
  const cropsQuery = useRecords('crops', { orderBy: { column: 'name' } });
  const save = useSaveRecord('crops');
  const remove = useDeleteRecord('crops');
  const { report } = useSeasonReport(seasonId);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Crop | null>(null);

  const defaults = useMemo(
    () => ({
      name: '',
      name_gu: '',
      category: 'other',
      default_unit: settings?.default_weight_unit ?? 'quintal',
      notes: '',
      is_active: true,
    }),
    [settings?.default_weight_unit],
  );

  const form = useZodForm(cropSchema, defaults);
  const metricsByCrop = useMemo(() => new Map(report.byCrop.map((c) => [c.cropId, c])), [report.byCrop]);

  const openForm = (crop: Crop | null) => {
    setEditing(crop);
    form.reset(
      crop
        ? {
            name: crop.name,
            name_gu: crop.name_gu,
            category: crop.category,
            default_unit: crop.default_unit,
            notes: crop.notes ?? '',
            is_active: crop.is_active,
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
        name_gu: result.data.name_gu ?? '',
        category: result.data.category,
        default_unit: result.data.default_unit,
        notes: result.data.notes || null,
        is_active: result.data.is_active,
      },
    });
    setOpen(false);
  };

  return (
    <RecordScreen<Crop>
      title={t('crops.title')}
      addLabel={t('crops.add')}
      emptyMessage={t('crops.empty')}
      emptyActionLabel={t('crops.emptyAction')}
      records={cropsQuery.data ?? []}
      loading={cropsQuery.isLoading}
      canEdit={isAdmin}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(crop) => remove.mutateAsync(crop.id)}
      deleteMessage={(crop) => t('crops.deleteConfirm', { name: crop.name })}
      renderItem={(crop) => {
        const metrics = metricsByCrop.get(crop.id);
        return (
          <div>
            <h3 className="text-lg font-bold">
              {crop.name}
              {crop.name_gu ? <span className="ml-2 text-base font-normal text-slate-600 dark:text-slate-400">{crop.name_gu}</span> : null}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t(`cropCategories.${crop.category}`)}</p>
            {metrics ? (
              <div className="mt-2">
                <RecordLine label={t('common.area')} value={`${formatNumber(metrics.acres, 2)} ${t('common.acres')}`} />
                <RecordLine label={t('reports.cost')} value={formatCurrency(metrics.cost)} />
                <RecordLine label={t('reports.revenue')} value={formatCurrency(metrics.revenue)} />
                <RecordLine label={t('reports.profit')} value={formatCurrency(metrics.profit)} />
                <RecordLine label={t('reports.roiShort')} value={`${formatNumber(metrics.roi, 1)}%`} />
                <RecordLine
                  label={t('reports.yieldPerAcre')}
                  value={`${formatNumber(metrics.yieldPerAcre, 2)} ${t('common.quintal')}`}
                />
              </div>
            ) : null}
          </div>
        );
      }}
    >
      <Modal
        open={open}
        title={editing ? t('crops.edit') : t('crops.add')}
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
          label={t('crops.name')}
          required
          value={str(form.values, 'name')}
          error={form.errors.name}
          onChange={(e) => form.setField('name', e.target.value)}
        />
        <TextField
          label={t('crops.nameGu')}
          value={str(form.values, 'name_gu')}
          error={form.errors.name_gu}
          onChange={(e) => form.setField('name_gu', e.target.value)}
        />
        <SelectField
          label={t('crops.category')}
          value={str(form.values, 'category')}
          error={form.errors.category}
          options={enumOptions(t, 'cropCategories', CROP_CATEGORIES)}
          onChange={(e) => form.setField('category', e.target.value)}
        />
        <UnitField
          kind="weight"
          label={t('crops.defaultUnit')}
          value={str(form.values, 'default_unit')}
          error={form.errors.default_unit}
          onChange={(value) => form.setField('default_unit', value)}
        />
        <TextAreaField
          label={t('common.notes')}
          value={str(form.values, 'notes')}
          error={form.errors.notes}
          onChange={(e) => form.setField('notes', e.target.value)}
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
