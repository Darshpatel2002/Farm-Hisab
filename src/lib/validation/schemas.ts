import { z } from 'zod';
import { isValidISODate } from '../formatting/date';
import { ACTIVITY_TYPES, CROP_CATEGORIES, EXPENSE_CATEGORIES } from '../../types/db';

/**
 * Form validation. Messages are i18n keys resolved by the form components,
 * so no user-facing English is hard-coded here.
 */

const requiredText = (max = 200) => z.string().trim().min(1, 'validation.required').max(max, 'validation.tooLong');
const optionalText = (max = 500) => z.string().trim().max(max, 'validation.tooLong').optional().or(z.literal(''));
const uuid = z.string().uuid('validation.required');
const optionalUuid = z.union([uuid, z.literal(''), z.null()]).optional();

const positiveNumber = z.coerce.number({ invalid_type_error: 'validation.number' })
  .finite('validation.number')
  .positive('validation.positive');

const nonNegativeNumber = z.coerce.number({ invalid_type_error: 'validation.number' })
  .finite('validation.number')
  .min(0, 'validation.nonNegative');

const optionalNonNegative = z
  .union([z.literal(''), z.null(), z.undefined(), nonNegativeNumber])
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)));

const isoDate = z.string().refine(isValidISODate, 'validation.date');
const optionalIsoDate = z
  .union([z.literal(''), z.null(), z.undefined(), isoDate])
  .transform((v) => (v === '' || v === undefined ? null : v));

// --- Auth --------------------------------------------------------------
export const signInSchema = z.object({
  email: z.string().trim().email('validation.email'),
  password: z.string().min(6, 'validation.passwordLength'),
});

export const signUpSchema = signInSchema.extend({
  fullName: requiredText(80),
  householdName: optionalText(80),
  inviteCode: optionalText(20),
});

export const forgotPasswordSchema = z.object({ email: z.string().trim().email('validation.email') });

// --- Masters -----------------------------------------------------------
export const farmSchema = z.object({
  name: requiredText(80),
  local_name: optionalText(80),
  area: positiveNumber,
  area_unit: requiredText(20),
  location_notes: optionalText(500),
  is_active: z.boolean().default(true),
});

export const seasonSchema = z
  .object({
    name: requiredText(80),
    year: z.coerce.number().int().min(1900, 'validation.year').max(2200, 'validation.year'),
    start_date: optionalIsoDate,
    end_date: optionalIsoDate,
    status: z.enum(['planned', 'active', 'completed']),
    notes: optionalText(500),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    message: 'validation.endBeforeStart',
    path: ['end_date'],
  });

export const cropSchema = z.object({
  name: requiredText(60),
  name_gu: optionalText(60),
  category: z.enum(CROP_CATEGORIES),
  default_unit: requiredText(20),
  notes: optionalText(500),
  is_active: z.boolean().default(true),
});

export const allocationSchema = z
  .object({
    farm_id: uuid,
    season_id: uuid,
    crop_id: uuid,
    area: positiveNumber,
    area_unit: requiredText(20),
    land_prep_date: optionalIsoDate,
    sowing_date: optionalIsoDate,
    germination_date: optionalIsoDate,
    expected_harvest_date: optionalIsoDate,
    actual_harvest_date: optionalIsoDate,
    status: z.enum(['planned', 'sown', 'growing', 'harvesting', 'harvested', 'sold', 'failed']),
    notes: optionalText(500),
  })
  .refine((v) => !v.sowing_date || !v.actual_harvest_date || v.actual_harvest_date >= v.sowing_date, {
    message: 'validation.harvestBeforeSowing',
    path: ['actual_harvest_date'],
  })
  .refine((v) => !v.sowing_date || !v.expected_harvest_date || v.expected_harvest_date >= v.sowing_date, {
    message: 'validation.harvestBeforeSowing',
    path: ['expected_harvest_date'],
  });

// --- Operations --------------------------------------------------------
export const activitySchema = z.object({
  season_id: uuid,
  farm_id: uuid,
  allocation_id: optionalUuid,
  date: isoDate,
  activity_type: z.enum(ACTIVITY_TYPES),
  description: optionalText(200),
  quantity: optionalNonNegative,
  unit: optionalText(20),
  cost: nonNegativeNumber,
  labour_days: optionalNonNegative,
  tractor_hours: optionalNonNegative,
  vendor: optionalText(80),
  notes: optionalText(500),
});

export const irrigationSchema = z.object({
  season_id: uuid,
  farm_id: uuid,
  allocation_id: optionalUuid,
  date: isoDate,
  irrigation_number: optionalNonNegative,
  water_source: z.enum(['borewell', 'canal', 'well', 'rain', 'other']),
  hours: optionalNonNegative,
  cost: nonNegativeNumber,
  notes: optionalText(500),
});

export const spraySchema = z
  .object({
    season_id: uuid,
    scope: z.enum(['farm', 'crop', 'season']),
    farm_id: optionalUuid,
    allocation_id: optionalUuid,
    crop_id: optionalUuid,
    date: isoDate,
    spray_number: optionalNonNegative,
    product_name: requiredText(100),
    purpose: z.enum(['pesticide', 'fungicide', 'herbicide', 'insecticide', 'growth', 'nutrient', 'other']),
    quantity: optionalNonNegative,
    unit: requiredText(20),
    rate: optionalNonNegative,
    material_cost: nonNegativeNumber,
    labour_cost: nonNegativeNumber,
    application_cost: nonNegativeNumber,
    notes: optionalText(500),
  })
  .refine((v) => v.scope !== 'farm' || Boolean(v.farm_id), { message: 'validation.required', path: ['farm_id'] })
  .refine((v) => v.scope !== 'crop' || Boolean(v.crop_id), { message: 'validation.required', path: ['crop_id'] });

export const fertilizerSchema = z.object({
  season_id: uuid,
  farm_id: uuid,
  allocation_id: optionalUuid,
  date: isoDate,
  product_name: requiredText(100),
  quantity: nonNegativeNumber,
  unit: requiredText(20),
  rate: nonNegativeNumber,
  labour_cost: nonNegativeNumber,
  notes: optionalText(500),
});

export const seedSchema = z.object({
  season_id: uuid,
  farm_id: uuid,
  allocation_id: optionalUuid,
  crop_id: optionalUuid,
  date: isoDate,
  variety: requiredText(100),
  quantity: nonNegativeNumber,
  unit: requiredText(20),
  price_per_unit: nonNegativeNumber,
  supplier: optionalText(100),
  notes: optionalText(500),
});

// --- Money -------------------------------------------------------------
export const expenseAllocationLineSchema = z.object({
  farm_id: uuid,
  allocation_id: optionalUuid,
  amount: nonNegativeNumber,
});

export const expenseSchema = z
  .object({
    season_id: uuid,
    date: isoDate,
    category: z.enum(EXPENSE_CATEGORIES),
    description: optionalText(200),
    amount: positiveNumber,
    allocation_method: z.enum(['direct', 'manual', 'area', 'equal']),
    farm_id: optionalUuid,
    allocation_id: optionalUuid,
    crop_id: optionalUuid,
    vendor: optionalText(100),
    quantity: optionalNonNegative,
    unit: optionalText(20),
    payment_method: z.enum(['cash', 'upi', 'bank', 'credit', 'other']),
    notes: optionalText(500),
    allocations: z.array(expenseAllocationLineSchema).default([]),
  })
  .refine((v) => v.allocation_method !== 'direct' || Boolean(v.farm_id), {
    message: 'validation.required',
    path: ['farm_id'],
  })
  .refine((v) => v.allocation_method === 'direct' || v.allocations.length > 0, {
    message: 'validation.pickAtLeastOneFarm',
    path: ['allocations'],
  })
  .refine(
    (v) =>
      v.allocation_method === 'direct' ||
      v.allocations.reduce((sum, line) => sum + Number(line.amount ?? 0), 0) <= Number(v.amount) + 0.01,
    { message: 'validation.allocationExceedsExpense', path: ['allocations'] },
  );

export const harvestSchema = z
  .object({
    season_id: uuid,
    farm_id: uuid,
    allocation_id: optionalUuid,
    crop_id: optionalUuid,
    start_date: isoDate,
    end_date: optionalIsoDate,
    quantity: nonNegativeNumber,
    unit: requiredText(20),
    quality: z.enum(['a', 'b', 'c', 'mixed']),
    wastage: nonNegativeNumber,
    labour_cost: nonNegativeNumber,
    harvest_cost: nonNegativeNumber,
    transport_cost: nonNegativeNumber,
    notes: optionalText(500),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { message: 'validation.endBeforeStart', path: ['end_date'] })
  .refine((v) => Number(v.wastage) <= Number(v.quantity), { message: 'validation.wastageTooHigh', path: ['wastage'] });

export const saleSchema = z.object({
  season_id: uuid,
  farm_id: optionalUuid,
  allocation_id: optionalUuid,
  crop_id: optionalUuid,
  date: isoDate,
  buyer: requiredText(100),
  quantity: positiveNumber,
  unit: requiredText(20),
  price_per_unit: nonNegativeNumber,
  transport_cost: nonNegativeNumber,
  commission: nonNegativeNumber,
  other_deductions: nonNegativeNumber,
  payment_status: z.enum(['received', 'pending', 'partial']),
  amount_received: nonNegativeNumber,
  notes: optionalText(500),
});

export const unitSchema = z.object({
  code: requiredText(20),
  label_en: requiredText(40),
  label_gu: optionalText(40),
  factor_to_base: positiveNumber,
  is_active: z.boolean().default(true),
});

export const settingsSchema = z.object({
  currency: requiredText(5),
  locale: requiredText(10),
  language: z.enum(['en', 'gu']),
  theme: z.enum(['light', 'dark', 'system']),
  default_season_id: optionalUuid,
  default_area_unit: requiredText(20),
  default_weight_unit: requiredText(20),
  allow_area_overallocation: z.boolean(),
  require_full_allocation: z.boolean(),
});

export type FarmInput = z.input<typeof farmSchema>;
export type SeasonInput = z.input<typeof seasonSchema>;
export type CropInput = z.input<typeof cropSchema>;
export type AllocationInput = z.input<typeof allocationSchema>;
export type ActivityInput = z.input<typeof activitySchema>;
export type IrrigationInput = z.input<typeof irrigationSchema>;
export type SprayInput = z.input<typeof spraySchema>;
export type FertilizerInput = z.input<typeof fertilizerSchema>;
export type SeedInput = z.input<typeof seedSchema>;
export type ExpenseInput = z.input<typeof expenseSchema>;
export type HarvestInput = z.input<typeof harvestSchema>;
export type SaleInput = z.input<typeof saleSchema>;

/** Flattens Zod issues into `{ fieldName: i18nKey }`. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

/**
 * Crop allocations may not exceed the remaining land on a farm unless the
 * household has explicitly allowed over-allocation in Settings.
 */
export function checkAreaFits(params: {
  farmAcres: number;
  alreadyAllocatedAcres: number;
  newAcres: number;
  allowOverallocation: boolean;
}): boolean {
  if (params.allowOverallocation) return true;
  return params.alreadyAllocatedAcres + params.newAcres <= params.farmAcres + 0.0001;
}
