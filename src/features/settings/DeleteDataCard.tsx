import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Card, SectionTitle } from '../../components/ui/Layout';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAppData } from '../../hooks/useAppData';
import { useRecords } from '../common/useRecords';
import { useSeasonReport } from '../reports/useSeasonReport';
import { callRpc } from '../../lib/supabase/crud';
import { toAppError } from '../../lib/errors';
import { formatCurrency, formatNumber } from '../../lib/formatting/number';

/**
 * Owner-only cleanup tools.
 *
 * Every option shows exactly what will be removed before asking to confirm,
 * and the "delete everything" option additionally requires typing DELETE.
 */

type Target = 'crop' | 'season' | 'all';

export function DeleteDataCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { seasons, farms, cropName, refresh } = useAppData();

  const [seasonId, setSeasonId] = useState('');
  const [farmId, setFarmId] = useState('');
  const [allocationId, setAllocationId] = useState('');
  const [target, setTarget] = useState<Target | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [busy, setBusy] = useState(false);

  const allocationsQuery = useRecords(
    'farm_crop_allocations',
    { match: { season_id: seasonId || undefined } },
    Boolean(seasonId),
  );
  const { report } = useSeasonReport(seasonId || null);

  const allocations = useMemo(
    () => (allocationsQuery.data ?? []).filter((a) => !farmId || a.farm_id === farmId),
    [allocationsQuery.data, farmId],
  );

  const cropMetrics = report.byAllocation.find((a) => a.allocationId === allocationId);
  const seasonName = seasons.find((s) => s.id === seasonId)?.name ?? '';

  const preview = (): string => {
    if (target === 'crop' && cropMetrics) {
      return [
        t('settings.cleanupPreview'),
        `${t('common.crop')}: ${cropName(cropMetrics.cropId)} — ${cropMetrics.farmName}`,
        `${t('reports.cost')}: ${formatCurrency(cropMetrics.cost)}`,
        `${t('reports.revenue')}: ${formatCurrency(cropMetrics.revenue)}`,
        `${t('farms.activityCount')}: ${formatNumber(cropMetrics.activityCount, 0)}`,
        `${t('farms.irrigationCount')}: ${formatNumber(cropMetrics.irrigationCount, 0)} · ${t('farms.sprayCount')}: ${formatNumber(cropMetrics.sprayCount, 0)}`,
        `${t('harvest.totalHarvested')}: ${formatNumber(cropMetrics.yieldQuintal, 2)} ${t('common.quintal')}`,
      ].join('\n');
    }
    if (target === 'season') {
      return [
        t('settings.cleanupPreview'),
        `${t('common.season')}: ${seasonName}`,
        `${t('reports.cost')}: ${formatCurrency(report.totals.cost)}`,
        `${t('reports.revenue')}: ${formatCurrency(report.totals.revenue)}`,
        `${t('allocations.title')}: ${formatNumber(report.byAllocation.length, 0)}`,
      ].join('\n');
    }
    return `${t('settings.cleanupPreview')}\n${t('settings.cleanupAllHelp')}`;
  };

  const run = async () => {
    setBusy(true);
    try {
      if (target === 'crop') await callRpc('delete_allocation_data', { p_allocation: allocationId });
      else if (target === 'season') await callRpc('delete_season_data', { p_season: seasonId });
      else await callRpc('reset_household_data');

      await queryClient.invalidateQueries();
      await refresh();
      setAllocationId('');
      if (target !== 'crop') setSeasonId('');
      toast.success(t('settings.cleanupDone'));
    } catch (error) {
      toast.error(t(toAppError(error).messageKey));
    } finally {
      setBusy(false);
      setTarget(null);
      setConfirmWord('');
    }
  };

  return (
    <Card className="mb-4 border-red-300 dark:border-red-800">
      <SectionTitle title={t('settings.cleanup')} />
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{t('settings.cleanupHelp')}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          label={t('common.season')}
          value={seasonId}
          placeholder={t('common.select')}
          options={seasons.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(e) => {
            setSeasonId(e.target.value);
            setAllocationId('');
          }}
        />
        <SelectField
          label={t('common.farm')}
          value={farmId}
          placeholder={t('common.all')}
          options={farms.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(e) => {
            setFarmId(e.target.value);
            setAllocationId('');
          }}
        />
        <SelectField
          label={t('common.crop')}
          value={allocationId}
          placeholder={t('common.select')}
          options={allocations.map((a) => ({
            value: a.id,
            label: `${cropName(a.crop_id)} — ${farms.find((f) => f.id === a.farm_id)?.name ?? ''}`,
          }))}
          onChange={(e) => setAllocationId(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <Button variant="danger" disabled={!allocationId} onClick={() => setTarget('crop')}>
            {t('settings.cleanupCrop')}
          </Button>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('settings.cleanupCropHelp')}</p>
        </div>
        <div>
          <Button variant="danger" disabled={!seasonId} onClick={() => setTarget('season')}>
            {t('settings.cleanupSeason')}
          </Button>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('settings.cleanupSeasonHelp')}</p>
        </div>
        <div>
          <Button variant="danger" onClick={() => setTarget('all')}>
            {t('settings.cleanupAll')}
          </Button>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('settings.cleanupAllHelp')}</p>
        </div>
      </div>

      <ConfirmDialog
        open={target !== null}
        title={
          target === 'crop'
            ? t('settings.cleanupCrop')
            : target === 'season'
              ? t('settings.cleanupSeason')
              : t('settings.cleanupAll')
        }
        message={preview()}
        confirmLabel={t('common.delete')}
        busy={busy}
        onCancel={() => {
          setTarget(null);
          setConfirmWord('');
        }}
        onConfirm={() => {
          // Wiping everything is irreversible, so it needs the word typed out.
          if (target === 'all' && confirmWord.trim().toUpperCase() !== t('settings.cleanupConfirmWord')) {
            toast.error(t('settings.cleanupTypeToConfirm'));
            return;
          }
          void run();
        }}
      >
        {target === 'all' ? (
          <div className="mt-4">
            <TextField
              label={t('settings.cleanupTypeToConfirm')}
              value={confirmWord}
              autoComplete="off"
              onChange={(e) => setConfirmWord(e.target.value)}
            />
          </div>
        ) : null}
      </ConfirmDialog>
    </Card>
  );
}
