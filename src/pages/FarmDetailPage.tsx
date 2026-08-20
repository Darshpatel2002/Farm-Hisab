import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Card, EmptyState, LoadingBlock, PageHeader, SectionTitle, StatCard, TrendValue } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { NumberField, SelectField, TextAreaField } from '../components/ui/Field';
import { CropField, DateField, UnitField, enumOptions } from '../components/records/Selectors';
import { RecordLine } from '../components/records/RecordScreen';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { useSeasonReport } from '../features/reports/useSeasonReport';
import { useZodForm, str } from '../features/common/useZodForm';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { allocationSchema, checkAreaFits } from '../lib/validation/schemas';
import { toAcres } from '../lib/calculations/units';
import { formatCurrency, formatNumber, safeNumber } from '../lib/formatting/number';
import { compareDates, formatDate, formatDayMonth, today } from '../lib/formatting/date';
import type { FarmCropAllocation } from '../types/db';

const ALLOCATION_STATUS = ['planned', 'sown', 'growing', 'harvesting', 'harvested', 'sold', 'failed'] as const;

interface TimelineEntry {
  date: string;
  label: string;
  detail: string;
}

export default function FarmDetailPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { farmById, seasonId, season, unitMap, settings, cropName } = useAppData();
  const { report, dataset, isLoading } = useSeasonReport(seasonId);

  const save = useSaveRecord('farm_crop_allocations');
  const remove = useDeleteRecord('farm_crop_allocations');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FarmCropAllocation | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FarmCropAllocation | null>(null);

  const farm = farmById.get(farmId) ?? null;
  const metrics = report.byFarm.find((f) => f.farmId === farmId) ?? null;
  const allocations = useMemo(
    () => dataset.allocations.filter((a) => a.farm_id === farmId),
    [dataset.allocations, farmId],
  );

  const irrigationsQuery = useRecords(
    'irrigation_records',
    { match: { season_id: seasonId ?? undefined, farm_id: farmId } },
    Boolean(seasonId && farmId),
  );

  const defaults = useMemo(
    () => ({
      farm_id: farmId,
      season_id: seasonId ?? '',
      crop_id: '',
      area: '',
      area_unit: farm?.area_unit ?? settings?.default_area_unit ?? 'vigha',
      land_prep_date: '',
      sowing_date: today(),
      germination_date: '',
      expected_harvest_date: '',
      actual_harvest_date: '',
      status: 'sown',
      notes: '',
    }),
    [farmId, seasonId, farm?.area_unit, settings?.default_area_unit],
  );

  const form = useZodForm(allocationSchema, defaults);

  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [];
    for (const allocation of allocations) {
      const crop = cropName(allocation.crop_id);
      if (allocation.land_prep_date) entries.push({ date: allocation.land_prep_date, label: t('allocations.landPrepDate'), detail: crop });
      if (allocation.sowing_date) entries.push({ date: allocation.sowing_date, label: t('allocations.sowingDate'), detail: crop });
      if (allocation.actual_harvest_date) entries.push({ date: allocation.actual_harvest_date, label: t('allocations.actualHarvestDate'), detail: crop });
    }
    for (const row of dataset.activities.filter((a) => a.farm_id === farmId)) {
      entries.push({ date: row.date, label: t(`activityTypes.${row.activity_type}`), detail: row.description });
    }
    for (const row of dataset.irrigations.filter((a) => a.farm_id === farmId)) {
      entries.push({ date: row.date, label: t('irrigation.nth', { number: row.irrigation_number ?? '-' }), detail: t(`waterSources.${row.water_source}`) });
    }
    for (const row of dataset.sprays.filter((a) => a.farm_id === farmId)) {
      entries.push({ date: row.date, label: t('sprays.nth', { number: row.spray_number ?? '-' }), detail: row.product_name });
    }
    for (const row of dataset.harvests.filter((a) => a.farm_id === farmId)) {
      entries.push({ date: row.start_date, label: t('harvest.title'), detail: `${formatNumber(row.net_quantity, 2)} ${row.unit}` });
    }
    for (const row of dataset.sales.filter((a) => a.farm_id === farmId)) {
      entries.push({ date: row.date, label: t('sales.title'), detail: formatCurrency(row.net_amount) });
    }
    return entries.sort((a, b) => compareDates(a.date, b.date));
  }, [allocations, dataset, farmId, t, cropName]);

  const openForm = (allocation: FarmCropAllocation | null) => {
    setEditing(allocation);
    form.reset(
      allocation
        ? {
            farm_id: allocation.farm_id,
            season_id: allocation.season_id,
            crop_id: allocation.crop_id,
            area: String(allocation.area),
            area_unit: allocation.area_unit,
            land_prep_date: allocation.land_prep_date ?? '',
            sowing_date: allocation.sowing_date ?? '',
            germination_date: allocation.germination_date ?? '',
            expected_harvest_date: allocation.expected_harvest_date ?? '',
            actual_harvest_date: allocation.actual_harvest_date ?? '',
            status: allocation.status,
            notes: allocation.notes ?? '',
          }
        : defaults,
    );
    setOpen(true);
  };

  const submit = async () => {
    const result = form.validate();
    if (!result.success || !farm) return;
    const data = result.data;
    const acres = toAcres(unitMap, data.area, data.area_unit);
    const alreadyAllocated = allocations
      .filter((a) => a.id !== editing?.id)
      .reduce((sum, a) => sum + safeNumber(a.acre_equivalent), 0);

    if (
      !checkAreaFits({
        farmAcres: safeNumber(farm.acre_equivalent),
        alreadyAllocatedAcres: alreadyAllocated,
        newAcres: acres,
        allowOverallocation: settings?.allow_area_overallocation ?? false,
      })
    ) {
      toast.error(t('validation.areaExceedsFarm'));
      return;
    }

    await save.mutateAsync({
      id: editing?.id,
      baseUpdatedAt: editing?.updated_at,
      values: {
        farm_id: data.farm_id,
        season_id: data.season_id,
        crop_id: data.crop_id,
        area: data.area,
        area_unit: data.area_unit,
        acre_equivalent: acres,
        land_prep_date: data.land_prep_date,
        sowing_date: data.sowing_date,
        germination_date: data.germination_date,
        expected_harvest_date: data.expected_harvest_date,
        actual_harvest_date: data.actual_harvest_date,
        status: data.status,
        notes: data.notes || null,
      },
    });
    setOpen(false);
  };

  if (isLoading) return <LoadingBlock label={t('app.loading')} />;
  if (!farm) return <EmptyState message={t('errors.notFound')} actionLabel={t('nav.farms')} to="/farms" />;

  const remainingAcres =
    safeNumber(farm.acre_equivalent) - allocations.reduce((sum, a) => sum + safeNumber(a.acre_equivalent), 0);

  return (
    <section>
      <PageHeader
        title={farm.name}
        subtitle={`${formatNumber(farm.area, 2)} ${farm.area_unit} · ${formatNumber(farm.acre_equivalent, 2)} ${t('common.acres')} · ${season?.name ?? ''}`}
        action={
          <Link to="/farms" className="min-h-touch rounded-xl px-3 py-2 text-base font-semibold underline">
            {t('common.back')}
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('farms.totalInvestment')} value={formatCurrency(metrics?.cost ?? 0)} />
        <StatCard label={t('dashboard.expectedRevenue')} value={formatCurrency(metrics?.expectedRevenue ?? 0)} />
        <StatCard label={t('dashboard.actualRevenue')} value={formatCurrency(metrics?.revenue ?? 0)} />
        <StatCard
          label={t('reports.profit')}
          value={formatCurrency(metrics?.profit ?? 0)}
          tone={(metrics?.profit ?? 0) >= 0 ? 'good' : 'bad'}
        />
        <StatCard label={t('reports.profitPerAcre')} value={formatCurrency(metrics?.profitPerAcre ?? 0)} />
        <StatCard
          label={t('reports.yield')}
          value={`${formatNumber(metrics?.yieldQuintal ?? 0, 2)} ${t('common.quintal')}`}
        />
        <StatCard label={t('farms.activityCount')} value={formatNumber(metrics?.activityCount ?? 0, 0)} />
        <StatCard
          label={`${t('farms.irrigationCount')} / ${t('farms.sprayCount')}`}
          value={`${formatNumber(metrics?.irrigationCount ?? irrigationsQuery.data?.length ?? 0, 0)} / ${formatNumber(metrics?.sprayCount ?? 0, 0)}`}
        />
      </div>

      <Card className="mb-4">
        <SectionTitle
          title={t('allocations.title')}
          action={
            isAdmin ? (
              <Button size="sm" onClick={() => openForm(null)}>
                {t('allocations.add')}
              </Button>
            ) : undefined
          }
        />
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          {t('allocations.remainingArea', { area: `${formatNumber(Math.max(remainingAcres, 0), 2)} ${t('common.acres')}` })}
        </p>
        {allocations.length === 0 ? (
          <p className="py-4 text-base text-slate-600 dark:text-slate-400">{t('allocations.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {allocations.map((allocation) => {
              const cropMetrics = report.byAllocation.find((a) => a.allocationId === allocation.id);
              return (
                <li key={allocation.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold">{cropName(allocation.crop_id)}</h3>
                    <Badge tone={allocation.status === 'sold' ? 'good' : 'neutral'}>
                      {t(`allocationStatus.${allocation.status}`)}
                    </Badge>
                  </div>
                  <RecordLine
                    label={t('allocations.area')}
                    value={`${formatNumber(allocation.area, 2)} ${allocation.area_unit}`}
                  />
                  <RecordLine label={t('allocations.sowingDate')} value={formatDate(allocation.sowing_date)} />
                  <RecordLine
                    label={t('allocations.expectedHarvestDate')}
                    value={formatDate(allocation.expected_harvest_date)}
                  />
                  <RecordLine label={t('reports.cost')} value={formatCurrency(cropMetrics?.cost ?? 0)} />
                  <RecordLine label={t('reports.revenue')} value={formatCurrency(cropMetrics?.revenue ?? 0)} />
                  <RecordLine
                    label={t('reports.profit')}
                    value={
                      <TrendValue value={cropMetrics?.profit ?? 0} formatted={formatCurrency(cropMetrics?.profit ?? 0)} />
                    }
                  />
                  <RecordLine label={t('reports.roiShort')} value={`${formatNumber(cropMetrics?.roi ?? 0, 1)}%`} />
                  <RecordLine
                    label={t('reports.yieldPerAcre')}
                    value={`${formatNumber(cropMetrics?.yieldPerAcre ?? 0, 2)} ${t('common.quintal')}`}
                  />
                  {isAdmin ? (
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openForm(allocation)}>
                        {t('common.edit')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPendingDelete(allocation)}>
                        {t('common.delete')}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle title={t('farms.timeline')} />
        {timeline.length === 0 ? (
          <p className="py-4 text-base text-slate-600 dark:text-slate-400">{t('empty.generic')}</p>
        ) : (
          <ol className="space-y-2">
            {timeline.map((entry, index) => (
              <li key={`${entry.date}-${index}`} className="flex gap-3 border-l-4 border-brand-300 pl-3">
                <span className="w-20 shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-400">
                  {formatDayMonth(entry.date)}
                </span>
                <span className="text-base">
                  <strong>{entry.label}</strong>
                  {entry.detail ? ` — ${entry.detail}` : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Modal
        open={open}
        title={editing ? t('allocations.edit') : t('allocations.add')}
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
        <CropField
          value={str(form.values, 'crop_id')}
          error={form.errors.crop_id}
          required
          onChange={(value) => form.setField('crop_id', value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('allocations.area')}
            required
            value={str(form.values, 'area')}
            error={form.errors.area}
            onChange={(e) => form.setField('area', e.target.value)}
          />
          <UnitField
            kind="area"
            value={str(form.values, 'area_unit')}
            error={form.errors.area_unit}
            onChange={(value) => form.setField('area_unit', value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label={t('allocations.landPrepDate')}
            value={str(form.values, 'land_prep_date')}
            error={form.errors.land_prep_date}
            onChange={(v) => form.setField('land_prep_date', v)}
          />
          <DateField
            label={t('allocations.sowingDate')}
            value={str(form.values, 'sowing_date')}
            error={form.errors.sowing_date}
            onChange={(v) => form.setField('sowing_date', v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label={t('allocations.germinationDate')}
            value={str(form.values, 'germination_date')}
            error={form.errors.germination_date}
            onChange={(v) => form.setField('germination_date', v)}
          />
          <DateField
            label={t('allocations.expectedHarvestDate')}
            value={str(form.values, 'expected_harvest_date')}
            error={form.errors.expected_harvest_date}
            onChange={(v) => form.setField('expected_harvest_date', v)}
          />
        </div>
        <DateField
          label={t('allocations.actualHarvestDate')}
          value={str(form.values, 'actual_harvest_date')}
          error={form.errors.actual_harvest_date}
          onChange={(v) => form.setField('actual_harvest_date', v)}
        />
        <SelectField
          label={t('common.status')}
          value={str(form.values, 'status')}
          error={form.errors.status}
          options={enumOptions(t, 'allocationStatus', ALLOCATION_STATUS)}
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
        open={pendingDelete !== null}
        title={t('common.delete')}
        message={t('allocations.deleteConfirm')}
        confirmLabel={t('common.delete')}
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await remove.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </section>
  );
}
