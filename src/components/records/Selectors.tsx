import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberField, SelectField, TextField, type Option } from '../ui/Field';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useAppData } from '../../hooks/useAppData';
import { useAuth } from '../../hooks/useAuth';
import { useRecords, useSaveRecord } from '../../features/common/useRecords';
import { unitsOfKind, toAcres } from '../../lib/calculations/units';
import { formatNumber, safeNumber } from '../../lib/formatting/number';
import { today } from '../../lib/formatting/date';
import type { FarmCropAllocation, UnitKind } from '../../types/db';

/**
 * Smart pickers used by every entry form.
 * Choosing a farm narrows the crop list to the crops actually planted there,
 * which is what makes quick entry possible with almost no typing.
 */

export function useSeasonAllocations(seasonId: string | null) {
  const query = useRecords(
    'farm_crop_allocations',
    { match: { season_id: seasonId ?? undefined } },
    Boolean(seasonId),
  );
  return query.data ?? [];
}

export function FarmField({
  value,
  onChange,
  error,
  required,
  includeAll = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  includeAll?: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  const { farms } = useAppData();
  const options: Option[] = farms.map((farm) => ({
    value: farm.id,
    label: farm.local_name ? `${farm.name} (${farm.local_name})` : farm.name,
  }));
  return (
    <SelectField
      label={label ?? t('common.farm')}
      value={value}
      required={required}
      error={error}
      placeholder={includeAll ? t('common.all') : t('common.select')}
      options={options}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function CropField({
  value,
  onChange,
  error,
  required,
  includeAll = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  includeAll?: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  const { crops, cropName } = useAppData();
  const options: Option[] = crops.map((crop) => ({ value: crop.id, label: cropName(crop.id) || crop.name }));
  return (
    <SelectField
      label={label ?? t('common.crop')}
      value={value}
      required={required}
      error={error}
      placeholder={includeAll ? t('common.all') : t('common.select')}
      options={options}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Crop plans (farm + crop) for the current season, optionally limited to one farm. */
export function AllocationField({
  seasonId,
  farmId,
  value,
  onChange,
  error,
  label,
}: {
  seasonId: string | null;
  farmId?: string;
  value: string;
  onChange: (value: string, allocation: FarmCropAllocation | null) => void;
  error?: string;
  label?: string;
}) {
  const { t } = useTranslation();
  const { cropName } = useAppData();
  const { isAdmin } = useAuth();
  const allocations = useSeasonAllocations(seasonId);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(
    () => (farmId ? allocations.filter((a) => a.farm_id === farmId) : allocations),
    [allocations, farmId],
  );

  const options: Option[] = filtered.map((allocation) => ({
    value: allocation.id,
    label: `${cropName(allocation.crop_id)} - ${formatNumber(allocation.area, 2)} ${allocation.area_unit}`,
  }));

  const canAdd = Boolean(isAdmin && seasonId && farmId);

  return (
    <>
      <SelectField
        label={label ?? t('common.crop')}
        value={value}
        error={error}
        placeholder={t('common.select')}
        options={options}
        hint={options.length === 0 ? t('allocations.noneForFarm') : undefined}
        onChange={(e) => {
          const allocation = filtered.find((a) => a.id === e.target.value) ?? null;
          onChange(e.target.value, allocation);
        }}
      />
      {canAdd ? (
        <Button variant="secondary" size="sm" className="mb-4" onClick={() => setAdding(true)}>
          ＋ {t('allocations.add')}
        </Button>
      ) : null}

      {adding && seasonId && farmId ? (
        <QuickCropPlan
          seasonId={seasonId}
          farmId={farmId}
          onClose={() => setAdding(false)}
          onCreated={(allocation) => {
            setAdding(false);
            onChange(allocation.id, allocation);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Assigns a crop to a farm without leaving the entry form, so recording an
 * expense never dead-ends on "this farm has no crop yet".
 */
function QuickCropPlan({
  seasonId,
  farmId,
  onClose,
  onCreated,
}: {
  seasonId: string;
  farmId: string;
  onClose: () => void;
  onCreated: (allocation: FarmCropAllocation) => void;
}) {
  const { t } = useTranslation();
  const { farmById, unitMap, settings } = useAppData();
  const save = useSaveRecord('farm_crop_allocations');
  const allocations = useSeasonAllocations(seasonId);

  const farm = farmById.get(farmId);
  const used = allocations
    .filter((a) => a.farm_id === farmId)
    .reduce((sum, a) => sum + safeNumber(a.acre_equivalent), 0);
  const remainingAcres = Math.max(safeNumber(farm?.acre_equivalent) - used, 0);

  const [cropId, setCropId] = useState('');
  const [area, setArea] = useState(String(farm?.area ?? ''));
  const [areaUnit, setAreaUnit] = useState(farm?.area_unit ?? settings?.default_area_unit ?? 'vigha');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!cropId) next.crop_id = 'validation.required';
    if (!(safeNumber(area) > 0)) next.area = 'validation.positive';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const created = await save.mutateAsync({
      values: {
        farm_id: farmId,
        season_id: seasonId,
        crop_id: cropId,
        area: safeNumber(area),
        area_unit: areaUnit,
        acre_equivalent: toAcres(unitMap, safeNumber(area), areaUnit),
        sowing_date: today(),
        status: 'sown',
      },
    });
    onCreated(created as FarmCropAllocation);
  };

  return (
    <Modal
      open
      title={t('allocations.add')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button fullWidth loading={save.isPending} onClick={() => void submit()}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-base font-semibold">{farm?.name}</p>
      <CropField value={cropId} error={errors.crop_id} required onChange={setCropId} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={t('allocations.area')}
          required
          value={area}
          error={errors.area}
          onChange={(e) => setArea(e.target.value)}
        />
        <UnitField kind="area" value={areaUnit} onChange={setAreaUnit} />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t('allocations.remainingArea', { area: `${formatNumber(remainingAcres, 2)} ${t('common.acres')}` })}
      </p>
    </Modal>
  );
}

export function UnitField({
  kind,
  value,
  onChange,
  error,
  label,
}: {
  kind: UnitKind;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
}) {
  const { t, i18n } = useTranslation();
  const { units } = useAppData();
  const options: Option[] = unitsOfKind(units, kind).map((unit) => ({
    value: unit.code,
    label: i18n.language === 'gu' && unit.label_gu ? unit.label_gu : unit.label_en,
  }));
  return (
    <SelectField
      label={label ?? t('common.unit')}
      value={value}
      error={error}
      options={options}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function DateField({
  value,
  onChange,
  error,
  label,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  required?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      label={label ?? t('common.date')}
      type="date"
      value={value}
      required={required}
      error={error}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Options built from a translation namespace, e.g. `categories.*`. */
export function enumOptions(t: (key: string) => string, namespace: string, values: readonly string[]): Option[] {
  return values.map((value) => ({ value, label: t(`${namespace}.${value}`) }));
}
