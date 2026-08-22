import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoSeasonNotice, RecordLine, RecordScreen } from '../components/records/RecordScreen';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { AllocationField, CropField, DateField, FarmField, UnitField, enumOptions } from '../components/records/Selectors';
import { PhotoField, PhotoThumb } from '../components/records/PhotoField';
import { FarmSplit, buildTargets } from '../components/records/FarmSplit';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { findSourceExpense, replaceExpenseAllocations } from '../features/expenses/allocationApi';
import { useZodForm, str } from '../features/common/useZodForm';
import { useRecent } from '../hooks/usePreferences';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { spraySchema } from '../lib/validation/schemas';
import { toAppError } from '../lib/errors';
import { today, formatDate } from '../lib/formatting/date';
import { currencySymbol, formatCurrency, formatNumber, round, safeNumber } from '../lib/formatting/number';
import type { SprayRecord } from '../types/db';

const PURPOSES = ['pesticide', 'fungicide', 'herbicide', 'insecticide', 'growth', 'nutrient', 'other'] as const;
const SCOPES = [
  { value: 'farm', labelKey: 'sprays.scopeFarm' },
  { value: 'crop', labelKey: 'sprays.scopeCrop' },
  { value: 'season', labelKey: 'sprays.scopeSeason' },
] as const;

export default function SpraysPage() {
  const { t } = useTranslation();
  const { seasonId, farmById, farms, cropName } = useAppData();
  const { profile } = useAuth();
  const toast = useToast();
  const { recent, remember } = useRecent('spray', { farm_id: '', product_name: '', unit: 'ml' });

  const query = useRecords(
    'spray_records',
    { match: { season_id: seasonId ?? undefined }, orderBy: { column: 'date', ascending: false } },
    Boolean(seasonId),
  );
  const save = useSaveRecord('spray_records');
  const remove = useDeleteRecord('spray_records');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SprayRecord | null>(null);
  const [splitFarms, setSplitFarms] = useState<string[]>([]);
  const [manualAmounts] = useState<Record<string, string>>({});

  const defaults = useMemo(
    () => ({
      season_id: seasonId ?? '',
      scope: 'farm',
      farm_id: recent.farm_id,
      allocation_id: '',
      crop_id: '',
      date: today(),
      spray_number: '',
      product_name: recent.product_name,
      purpose: 'pesticide',
      quantity: '',
      unit: recent.unit,
      rate: '',
      material_cost: '',
      labour_cost: '0',
      application_cost: '0',
      notes: '',
      photo_url: '',
    }),
    [seasonId, recent],
  );

  const form = useZodForm(spraySchema, defaults);
  const scope = str(form.values, 'scope');

  const totalCost = round(
    safeNumber(form.values.material_cost) + safeNumber(form.values.labour_cost) + safeNumber(form.values.application_cost),
    2,
  );

  const openForm = (row: SprayRecord | null) => {
    setEditing(row);
    setSplitFarms([]);
    form.reset(
      row
        ? {
            season_id: row.season_id,
            scope: row.scope,
            farm_id: row.farm_id ?? '',
            allocation_id: row.allocation_id ?? '',
            crop_id: row.crop_id ?? '',
            date: row.date,
            spray_number: row.spray_number ?? '',
            product_name: row.product_name,
            purpose: row.purpose,
            quantity: row.quantity ?? '',
            unit: row.unit,
            rate: row.rate ?? '',
            material_cost: String(row.material_cost),
            labour_cost: String(row.labour_cost),
            application_cost: String(row.application_cost),
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

    const saved = await save.mutateAsync({
      id: editing?.id,
      baseUpdatedAt: editing?.updated_at,
      values: {
        season_id: data.season_id,
        scope: data.scope,
        farm_id: data.scope === 'farm' ? data.farm_id : null,
        allocation_id: data.scope === 'farm' ? data.allocation_id || null : null,
        crop_id: data.crop_id || null,
        date: data.date,
        spray_number: data.spray_number,
        product_name: data.product_name,
        purpose: data.purpose,
        quantity: data.quantity,
        unit: data.unit,
        rate: data.rate,
        material_cost: data.material_cost,
        labour_cost: data.labour_cost,
        application_cost: data.application_cost,
        notes: data.notes || null,
        photo_url: data.photo_url || null,
      },
    });

    // A crop-wide or season-wide spray creates one expense which is then
    // split by area across the chosen farms.
    if (data.scope !== 'farm' && splitFarms.length > 0 && profile) {
      try {
        const expense = await findSourceExpense('spray', (saved as SprayRecord).id);
        if (expense) {
          await replaceExpenseAllocations({
            householdId: profile.household_id,
            expenseId: expense.id,
            total: safeNumber(expense.amount),
            targets: buildTargets(splitFarms, farms, manualAmounts),
            basis: 'area',
          });
        }
      } catch (error) {
        toast.error(t(toAppError(error).messageKey));
      }
    }

    remember({ farm_id: data.farm_id ?? '', product_name: data.product_name, unit: data.unit });
    setOpen(false);
  };

  if (!seasonId) return <NoSeasonNotice />;

  return (
    <RecordScreen<SprayRecord>
      title={t('sprays.title')}
      addLabel={t('sprays.add')}
      emptyMessage={t('sprays.empty')}
      emptyActionLabel={t('sprays.emptyAction')}
      records={query.data ?? []}
      loading={query.isLoading}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(row) => remove.mutateAsync(row.id)}
      deleteMessage={() => t('sprays.deleteConfirm')}
      renderItem={(row) => (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">{row.product_name || t('sprays.title')}</h3>
            <span className="text-base font-semibold">{formatCurrency(row.total_cost)}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('sprays.nth', { number: row.spray_number ?? '-' })} · {formatDate(row.date)} ·{' '}
            {row.farm_id ? (farmById.get(row.farm_id)?.name ?? '') : cropName(row.crop_id)}
          </p>
          <RecordLine label={t('sprays.purpose')} value={t(`purposes.${row.purpose}`)} />
          {row.quantity ? (
            <RecordLine label={t('common.quantity')} value={`${formatNumber(row.quantity, 2)} ${row.unit}`} />
          ) : null}
          <RecordLine label={t('sprays.materialCost')} value={formatCurrency(row.material_cost)} />
          <RecordLine label={t('common.labourCost')} value={formatCurrency(row.labour_cost)} />
          {row.photo_url ? <PhotoThumb url={row.photo_url} /> : null}
        </div>
      )}
    >
      <Modal
        open={open}
        title={editing ? t('sprays.edit') : t('sprays.add')}
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
        <SelectField
          label={t('sprays.scope')}
          value={scope}
          error={form.errors.scope}
          options={SCOPES.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
          onChange={(e) => form.setField('scope', e.target.value)}
        />

        {scope === 'farm' ? (
          <>
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
          </>
        ) : (
          <>
            <CropField
              value={str(form.values, 'crop_id')}
              error={form.errors.crop_id}
              required={scope === 'crop'}
              onChange={(value) => form.setField('crop_id', value)}
            />
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{t('sprays.sharedHelp')}</p>
            <FarmSplit
              total={totalCost}
              basis="area"
              selected={splitFarms}
              manualAmounts={manualAmounts}
              onToggleFarm={(farmId, checked) =>
                setSplitFarms((current) => (checked ? [...current, farmId] : current.filter((id) => id !== farmId)))
              }
              onManualChange={() => undefined}
            />
          </>
        )}

        <DateField value={str(form.values, 'date')} error={form.errors.date} required onChange={(v) => form.setField('date', v)} />
        <TextField
          label={t('sprays.product')}
          required
          value={str(form.values, 'product_name')}
          error={form.errors.product_name}
          onChange={(e) => form.setField('product_name', e.target.value)}
        />
        <SelectField
          label={t('sprays.purpose')}
          value={str(form.values, 'purpose')}
          error={form.errors.purpose}
          options={enumOptions(t, 'purposes', PURPOSES)}
          onChange={(e) => form.setField('purpose', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('common.quantity')}
            value={str(form.values, 'quantity')}
            error={form.errors.quantity}
            onChange={(e) => {
              form.setField('quantity', e.target.value);
              const rate = safeNumber(form.values.rate);
              if (rate > 0) form.setField('material_cost', String(round(safeNumber(e.target.value) * rate, 2)));
            }}
          />
          <UnitField
            kind="volume"
            value={str(form.values, 'unit')}
            error={form.errors.unit}
            onChange={(value) => form.setField('unit', value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('common.rate')}
            prefix={currencySymbol()}
            value={str(form.values, 'rate')}
            error={form.errors.rate}
            onChange={(e) => {
              form.setField('rate', e.target.value);
              const quantity = safeNumber(form.values.quantity);
              if (quantity > 0) form.setField('material_cost', String(round(quantity * safeNumber(e.target.value), 2)));
            }}
          />
          <NumberField
            label={t('sprays.materialCost')}
            required
            prefix={currencySymbol()}
            value={str(form.values, 'material_cost')}
            error={form.errors.material_cost}
            onChange={(e) => form.setField('material_cost', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('common.labourCost')}
            prefix={currencySymbol()}
            value={str(form.values, 'labour_cost')}
            error={form.errors.labour_cost}
            onChange={(e) => form.setField('labour_cost', e.target.value)}
          />
          <NumberField
            label={t('sprays.applicationCost')}
            prefix={currencySymbol()}
            value={str(form.values, 'application_cost')}
            error={form.errors.application_cost}
            onChange={(e) => form.setField('application_cost', e.target.value)}
          />
        </div>
        <p className="mb-3 text-lg font-bold">
          {t('common.total')}: {formatCurrency(totalCost)}
        </p>
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
