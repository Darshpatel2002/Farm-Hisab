import { indexUnits } from '../calculations/units';
import type {
  Activity,
  Crop,
  Expense,
  ExpenseAllocation,
  Farm,
  FarmCropAllocation,
  Harvest,
  IrrigationRecord,
  Sale,
  SprayRecord,
  Unit,
} from '../../types/db';

/** Row builders used by the calculation tests. */

const AUDIT = {
  created_by: null,
  updated_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
};

const HOUSEHOLD = 'household-1';
export const SEASON = 'season-2026';

export const TEST_UNITS: Unit[] = [
  { id: 'u1', household_id: HOUSEHOLD, kind: 'area', code: 'acre', label_en: 'Acre', label_gu: '', factor_to_base: 1, is_active: true, sort_order: 1, created_at: '', updated_at: '' },
  { id: 'u2', household_id: HOUSEHOLD, kind: 'area', code: 'vigha', label_en: 'Vigha', label_gu: '', factor_to_base: 0.4, is_active: true, sort_order: 2, created_at: '', updated_at: '' },
  { id: 'u3', household_id: HOUSEHOLD, kind: 'weight', code: 'kg', label_en: 'Kg', label_gu: '', factor_to_base: 1, is_active: true, sort_order: 1, created_at: '', updated_at: '' },
  { id: 'u4', household_id: HOUSEHOLD, kind: 'weight', code: 'quintal', label_en: 'Quintal', label_gu: '', factor_to_base: 100, is_active: true, sort_order: 2, created_at: '', updated_at: '' },
];

export const unitMap = indexUnits(TEST_UNITS);

export function farm(id: string, acres: number, name = id): Farm {
  return {
    ...AUDIT,
    id,
    household_id: HOUSEHOLD,
    name,
    local_name: '',
    area: acres,
    area_unit: 'acre',
    acre_equivalent: acres,
    location_notes: null,
    is_active: true,
  };
}

export function crop(id: string, name = id): Crop {
  return {
    ...AUDIT,
    id,
    household_id: HOUSEHOLD,
    name,
    name_gu: '',
    category: 'other',
    default_unit: 'quintal',
    notes: null,
    is_active: true,
  };
}

export function allocation(id: string, farmId: string, cropId: string, acres: number): FarmCropAllocation {
  return {
    ...AUDIT,
    id,
    household_id: HOUSEHOLD,
    farm_id: farmId,
    season_id: SEASON,
    crop_id: cropId,
    area: acres,
    area_unit: 'acre',
    acre_equivalent: acres,
    land_prep_date: null,
    sowing_date: '2026-06-10',
    germination_date: null,
    expected_harvest_date: '2026-10-01',
    actual_harvest_date: null,
    status: 'growing',
    notes: null,
  };
}

export function expense(
  id: string,
  amount: number,
  options: Partial<Expense> = {},
): Expense {
  return {
    ...AUDIT,
    id,
    household_id: HOUSEHOLD,
    season_id: SEASON,
    date: '2026-06-15',
    category: 'other',
    description: '',
    amount,
    farm_id: null,
    allocation_id: null,
    crop_id: null,
    allocation_method: 'direct',
    vendor: null,
    quantity: null,
    unit: null,
    payment_method: 'cash',
    notes: null,
    source_type: 'manual',
    source_id: null,
    ...options,
  };
}

export function expenseAllocation(
  id: string,
  expenseId: string,
  farmId: string,
  amount: number,
  allocationId: string | null = null,
): ExpenseAllocation {
  return {
    id,
    household_id: HOUSEHOLD,
    expense_id: expenseId,
    farm_id: farmId,
    allocation_id: allocationId,
    amount,
    basis: 'manual',
    created_at: '',
    updated_at: '',
  };
}

export function harvest(id: string, farmId: string, quantity: number, options: Partial<Harvest> = {}): Harvest {
  const wastage = options.wastage ?? 0;
  return {
    ...AUDIT,
    id,
    household_id: HOUSEHOLD,
    season_id: SEASON,
    farm_id: farmId,
    allocation_id: null,
    crop_id: null,
    start_date: '2026-10-05',
    end_date: null,
    quantity,
    unit: 'quintal',
    quality: 'a',
    wastage,
    net_quantity: Math.max(quantity - wastage, 0),
    labour_cost: 0,
    harvest_cost: 0,
    transport_cost: 0,
    total_cost: 0,
    notes: null,
    ...options,
  };
}

export function sale(id: string, farmId: string | null, quantity: number, price: number, options: Partial<Sale> = {}): Sale {
  const transport = options.transport_cost ?? 0;
  const commission = options.commission ?? 0;
  const other = options.other_deductions ?? 0;
  const gross = quantity * price;
  return {
    ...AUDIT,
    id,
    household_id: HOUSEHOLD,
    season_id: SEASON,
    farm_id: farmId,
    allocation_id: null,
    crop_id: null,
    date: '2026-11-01',
    buyer: 'Buyer',
    quantity,
    unit: 'quintal',
    price_per_unit: price,
    gross_amount: gross,
    transport_cost: transport,
    commission,
    other_deductions: other,
    net_amount: gross - transport - commission - other,
    payment_status: 'received',
    amount_received: gross - transport - commission - other,
    notes: null,
    ...options,
  };
}

export function activity(id: string, farmId: string, options: Partial<Activity> = {}): Activity {
  return {
    ...AUDIT,
    id,
    household_id: HOUSEHOLD,
    season_id: SEASON,
    farm_id: farmId,
    allocation_id: null,
    date: '2026-06-20',
    activity_type: 'labour',
    description: '',
    quantity: null,
    unit: null,
    cost: 0,
    labour_days: null,
    tractor_hours: null,
    vendor: null,
    notes: null,
    ...options,
  };
}

export function irrigation(id: string, farmId: string, options: Partial<IrrigationRecord> = {}): IrrigationRecord {
  return {
    ...AUDIT,
    id,
    household_id: HOUSEHOLD,
    season_id: SEASON,
    farm_id: farmId,
    allocation_id: null,
    date: '2026-07-01',
    irrigation_number: 1,
    water_source: 'borewell',
    hours: null,
    cost: 0,
    notes: null,
    ...options,
  };
}

export function spray(id: string, farmId: string | null, options: Partial<SprayRecord> = {}): SprayRecord {
  return {
    ...AUDIT,
    id,
    household_id: HOUSEHOLD,
    season_id: SEASON,
    farm_id: farmId,
    allocation_id: null,
    crop_id: null,
    scope: 'farm',
    date: '2026-07-15',
    spray_number: 1,
    product_name: 'Medicine',
    purpose: 'pesticide',
    quantity: null,
    unit: 'ml',
    rate: null,
    material_cost: 0,
    labour_cost: 0,
    application_cost: 0,
    total_cost: 0,
    notes: null,
    ...options,
  };
}
