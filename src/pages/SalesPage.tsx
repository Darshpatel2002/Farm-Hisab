import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoSeasonNotice, RecordLine, RecordScreen } from '../components/records/RecordScreen';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { AllocationField, DateField, FarmField, UnitField, enumOptions } from '../components/records/Selectors';
import { PhotoField, PhotoThumb } from '../components/records/PhotoField';
import { useDeleteRecord, useRecords, useSaveRecord } from '../features/common/useRecords';
import { useZodForm, str } from '../features/common/useZodForm';
import { useRecent } from '../hooks/usePreferences';
import { useAppData } from '../hooks/useAppData';
import { saleSchema } from '../lib/validation/schemas';
import { today, formatDate } from '../lib/formatting/date';
import { currencySymbol, formatCurrency, formatNumber, round, safeNumber } from '../lib/formatting/number';
import type { Sale } from '../types/db';

const STATUSES = ['received', 'pending', 'partial'] as const;

export default function SalesPage() {
  const { t } = useTranslation();
  const { seasonId, farmById, cropName, settings } = useAppData();
  const { recent, remember } = useRecent('sale', { farm_id: '', buyer: '', unit: 'quintal' });

  const query = useRecords(
    'sales',
    { match: { season_id: seasonId ?? undefined }, orderBy: { column: 'date', ascending: false } },
    Boolean(seasonId),
  );
  const save = useSaveRecord('sales');
  const remove = useDeleteRecord('sales');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);

  const defaults = useMemo(
    () => ({
      season_id: seasonId ?? '',
      farm_id: recent.farm_id,
      allocation_id: '',
      crop_id: '',
      date: today(),
      buyer: recent.buyer,
      quantity: '',
      unit: recent.unit || settings?.default_weight_unit || 'quintal',
      price_per_unit: '',
      transport_cost: '0',
      commission: '0',
      other_deductions: '0',
      payment_status: 'received',
      amount_received: '0',
      notes: '',
      photo_url: '',
    }),
    [seasonId, recent, settings?.default_weight_unit],
  );

  const form = useZodForm(saleSchema, defaults);

  const gross = round(safeNumber(form.values.quantity) * safeNumber(form.values.price_per_unit), 2);
  const net = round(
    gross - safeNumber(form.values.transport_cost) - safeNumber(form.values.commission) - safeNumber(form.values.other_deductions),
    2,
  );

  const openForm = (row: Sale | null) => {
    setEditing(row);
    form.reset(
      row
        ? {
            season_id: row.season_id,
            farm_id: row.farm_id ?? '',
            allocation_id: row.allocation_id ?? '',
            crop_id: row.crop_id ?? '',
            date: row.date,
            buyer: row.buyer,
            quantity: String(row.quantity),
            unit: row.unit,
            price_per_unit: String(row.price_per_unit),
            transport_cost: String(row.transport_cost),
            commission: String(row.commission),
            other_deductions: String(row.other_deductions),
            payment_status: row.payment_status,
            amount_received: String(row.amount_received),
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
        farm_id: data.farm_id || null,
        allocation_id: data.allocation_id || null,
        crop_id: data.crop_id || null,
        date: data.date,
        buyer: data.buyer,
        quantity: data.quantity,
        unit: data.unit,
        price_per_unit: data.price_per_unit,
        transport_cost: data.transport_cost,
        commission: data.commission,
        other_deductions: data.other_deductions,
        payment_status: data.payment_status,
        amount_received: data.payment_status === 'received' ? net : data.amount_received,
        notes: data.notes || null,
        photo_url: data.photo_url || null,
      },
    });
    remember({ farm_id: data.farm_id ?? '', buyer: data.buyer, unit: data.unit });
    setOpen(false);
  };

  if (!seasonId) return <NoSeasonNotice />;

  return (
    <RecordScreen<Sale>
      title={t('sales.title')}
      addLabel={t('sales.add')}
      emptyMessage={t('sales.empty')}
      emptyActionLabel={t('sales.emptyAction')}
      records={query.data ?? []}
      loading={query.isLoading}
      onAdd={() => openForm(null)}
      onEdit={openForm}
      onDelete={(row) => remove.mutateAsync(row.id)}
      deleteMessage={(row) => t('sales.deleteConfirm', { amount: formatCurrency(row.net_amount) })}
      renderItem={(row) => (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">{cropName(row.crop_id) || row.buyer}</h3>
            <span className="text-base font-semibold">{formatCurrency(row.net_amount)}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatDate(row.date)} · {row.farm_id ? (farmById.get(row.farm_id)?.name ?? '') : ''} · {row.buyer}
          </p>
          <RecordLine label={t('sales.quantitySold')} value={`${formatNumber(row.quantity, 2)} ${row.unit}`} />
          <RecordLine label={t('sales.pricePerUnit')} value={formatCurrency(row.price_per_unit)} />
          <RecordLine label={t('sales.grossAmount')} value={formatCurrency(row.gross_amount)} />
          <RecordLine
            label={t('sales.deductions')}
            value={formatCurrency(row.transport_cost + row.commission + row.other_deductions)}
          />
          <RecordLine label={t('sales.paymentStatus')} value={t(`paymentStatus.${row.payment_status}`)} />
          {row.photo_url ? <PhotoThumb url={row.photo_url} /> : null}
        </div>
      )}
    >
      <Modal
        open={open}
        title={editing ? t('sales.edit') : t('sales.add')}
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
        <DateField value={str(form.values, 'date')} error={form.errors.date} required onChange={(v) => form.setField('date', v)} />
        <TextField
          label={t('common.buyer')}
          required
          value={str(form.values, 'buyer')}
          error={form.errors.buyer}
          onChange={(e) => form.setField('buyer', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('common.quantity')}
            required
            value={str(form.values, 'quantity')}
            error={form.errors.quantity}
            onChange={(e) => form.setField('quantity', e.target.value)}
          />
          <UnitField
            kind="weight"
            value={str(form.values, 'unit')}
            error={form.errors.unit}
            onChange={(value) => form.setField('unit', value)}
          />
        </div>
        <NumberField
          label={t('sales.pricePerUnit')}
          required
          prefix={currencySymbol()}
          value={str(form.values, 'price_per_unit')}
          error={form.errors.price_per_unit}
          onChange={(e) => form.setField('price_per_unit', e.target.value)}
        />
        <p className="mb-3 text-base font-semibold">
          {t('sales.grossAmount')}: {formatCurrency(gross)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('common.transportCost')}
            prefix={currencySymbol()}
            value={str(form.values, 'transport_cost')}
            error={form.errors.transport_cost}
            onChange={(e) => form.setField('transport_cost', e.target.value)}
          />
          <NumberField
            label={t('sales.commission')}
            prefix={currencySymbol()}
            value={str(form.values, 'commission')}
            error={form.errors.commission}
            onChange={(e) => form.setField('commission', e.target.value)}
          />
        </div>
        <NumberField
          label={t('sales.otherDeductions')}
          prefix={currencySymbol()}
          value={str(form.values, 'other_deductions')}
          error={form.errors.other_deductions}
          onChange={(e) => form.setField('other_deductions', e.target.value)}
        />
        <p className="mb-3 text-lg font-bold">
          {t('sales.netRevenue')}: {formatCurrency(net)}
        </p>
        <SelectField
          label={t('sales.paymentStatus')}
          value={str(form.values, 'payment_status')}
          error={form.errors.payment_status}
          options={enumOptions(t, 'paymentStatus', STATUSES)}
          onChange={(e) => form.setField('payment_status', e.target.value)}
        />
        {str(form.values, 'payment_status') === 'partial' ? (
          <NumberField
            label={t('sales.amountReceived')}
            prefix={currencySymbol()}
            value={str(form.values, 'amount_received')}
            error={form.errors.amount_received}
            onChange={(e) => form.setField('amount_received', e.target.value)}
          />
        ) : null}
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
