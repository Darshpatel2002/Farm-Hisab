import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectField, TextField, type Option } from '../ui/Field';
import { useAppData } from '../../hooks/useAppData';
import { useRecords } from '../../features/common/useRecords';
import { unitsOfKind } from '../../lib/calculations/units';
import { formatNumber } from '../../lib/formatting/number';
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
  const allocations = useSeasonAllocations(seasonId);

  const filtered = useMemo(
    () => (farmId ? allocations.filter((a) => a.farm_id === farmId) : allocations),
    [allocations, farmId],
  );

  const options: Option[] = filtered.map((allocation) => ({
    value: allocation.id,
    label: `${cropName(allocation.crop_id)} - ${formatNumber(allocation.area, 2)} ${allocation.area_unit}`,
  }));

  return (
    <SelectField
      label={label ?? t('common.crop')}
      value={value}
      error={error}
      placeholder={t('common.select')}
      options={options}
      onChange={(e) => {
        const allocation = filtered.find((a) => a.id === e.target.value) ?? null;
        onChange(e.target.value, allocation);
      }}
    />
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
