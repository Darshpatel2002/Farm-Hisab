/**
 * Row shapes for every table in the Supabase schema.
 * These mirror supabase/migrations and are the single typing contract
 * between the database and the application.
 */

export type UUID = string;
/** ISO date string, `YYYY-MM-DD`. Dates are stored as PostgreSQL `date`. */
export type ISODate = string;
export type ISODateTime = string;

export type Role = 'admin' | 'member';
export type Language = 'en' | 'gu';
export type Theme = 'light' | 'dark' | 'system';
export type UnitKind = 'area' | 'weight' | 'volume' | 'time' | 'count';
export type SeasonStatus = 'planned' | 'active' | 'completed';
export type AllocationStatus = 'planned' | 'sown' | 'growing' | 'harvesting' | 'harvested' | 'sold' | 'failed';
export type AllocationMethod = 'direct' | 'manual' | 'area' | 'equal';
export type PaymentMethod = 'cash' | 'upi' | 'bank' | 'credit' | 'other';
export type PaymentStatus = 'received' | 'pending' | 'partial';
export type WaterSource = 'borewell' | 'canal' | 'well' | 'rain' | 'other';
export type SprayPurpose = 'pesticide' | 'fungicide' | 'herbicide' | 'insecticide' | 'growth' | 'nutrient' | 'other';
export type SprayScope = 'farm' | 'crop' | 'season';
export type HarvestQuality = 'a' | 'b' | 'c' | 'mixed';
export type ExpenseSource = 'manual' | 'spray' | 'irrigation' | 'fertilizer' | 'seed' | 'activity' | 'harvest' | 'sale';

export const EXPENSE_CATEGORIES = [
  'seeds', 'tractor', 'land_preparation', 'sowing', 'fertilizer', 'pesticide', 'herbicide',
  'fungicide', 'spray', 'irrigation', 'labour', 'harvesting', 'transportation', 'machinery',
  'fuel', 'electricity', 'rent', 'storage', 'packaging', 'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const ACTIVITY_TYPES = [
  'land_preparation', 'tractor', 'ploughing', 'rotavator', 'sowing', 'seeding', 'fertilizer',
  'irrigation', 'spray', 'weed_control', 'pest_control', 'labour', 'harvesting', 'transport', 'other',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const CROP_CATEGORIES = ['cereal', 'pulse', 'oilseed', 'cash_crop', 'vegetable', 'fodder', 'other'] as const;
export type CropCategory = (typeof CROP_CATEGORIES)[number];

interface AuditColumns {
  created_by: UUID | null;
  updated_by: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

interface SoftDelete {
  deleted_at: ISODateTime | null;
}

export interface Household {
  id: UUID;
  name: string;
  invite_code: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Profile {
  id: UUID;
  household_id: UUID;
  full_name: string;
  role: Role;
  language: Language;
  is_active: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface HouseholdSettings {
  household_id: UUID;
  currency: string;
  locale: string;
  language: Language;
  theme: Theme;
  timezone: string;
  default_season_id: UUID | null;
  default_area_unit: string;
  default_weight_unit: string;
  allow_area_overallocation: boolean;
  require_full_allocation: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Unit {
  id: UUID;
  household_id: UUID;
  kind: UnitKind;
  code: string;
  label_en: string;
  label_gu: string;
  factor_to_base: number;
  is_active: boolean;
  sort_order: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Season extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  name: string;
  year: number;
  start_date: ISODate | null;
  end_date: ISODate | null;
  status: SeasonStatus;
  notes: string | null;
  closed_at: ISODateTime | null;
}

export interface Farm extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  name: string;
  local_name: string;
  area: number;
  area_unit: string;
  acre_equivalent: number;
  location_notes: string | null;
  is_active: boolean;
}

export interface Crop extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  name: string;
  name_gu: string;
  category: CropCategory | string;
  default_unit: string;
  notes: string | null;
  is_active: boolean;
}

export interface FarmCropAllocation extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  farm_id: UUID;
  season_id: UUID;
  crop_id: UUID;
  area: number;
  area_unit: string;
  acre_equivalent: number;
  land_prep_date: ISODate | null;
  sowing_date: ISODate | null;
  germination_date: ISODate | null;
  expected_harvest_date: ISODate | null;
  actual_harvest_date: ISODate | null;
  status: AllocationStatus;
  notes: string | null;
}

export interface Party {
  id: UUID;
  household_id: UUID;
  name: string;
  phone: string | null;
  notes: string | null;
  deleted_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}
export type Vendor = Party;
export type Buyer = Party;

export interface Expense extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  season_id: UUID;
  date: ISODate;
  category: ExpenseCategory | string;
  description: string;
  amount: number;
  farm_id: UUID | null;
  allocation_id: UUID | null;
  crop_id: UUID | null;
  allocation_method: AllocationMethod;
  vendor: string | null;
  quantity: number | null;
  unit: string | null;
  payment_method: PaymentMethod;
  notes: string | null;
  source_type: ExpenseSource;
  source_id: UUID | null;
}

export interface ExpenseAllocation {
  id: UUID;
  household_id: UUID;
  expense_id: UUID;
  farm_id: UUID;
  allocation_id: UUID | null;
  amount: number;
  basis: AllocationMethod;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Activity extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  season_id: UUID;
  farm_id: UUID;
  allocation_id: UUID | null;
  date: ISODate;
  activity_type: ActivityType | string;
  description: string;
  quantity: number | null;
  unit: string | null;
  cost: number;
  labour_days: number | null;
  tractor_hours: number | null;
  vendor: string | null;
  notes: string | null;
}

export interface IrrigationRecord extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  season_id: UUID;
  farm_id: UUID;
  allocation_id: UUID | null;
  date: ISODate;
  irrigation_number: number | null;
  water_source: WaterSource;
  hours: number | null;
  cost: number;
  notes: string | null;
}

export interface SprayRecord extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  season_id: UUID;
  farm_id: UUID | null;
  allocation_id: UUID | null;
  crop_id: UUID | null;
  scope: SprayScope;
  date: ISODate;
  spray_number: number | null;
  product_name: string;
  purpose: SprayPurpose;
  quantity: number | null;
  unit: string;
  rate: number | null;
  material_cost: number;
  labour_cost: number;
  application_cost: number;
  /** Generated column: material + labour + application. */
  total_cost: number;
  notes: string | null;
}

export interface FertilizerRecord extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  season_id: UUID;
  farm_id: UUID;
  allocation_id: UUID | null;
  date: ISODate;
  product_name: string;
  quantity: number;
  unit: string;
  rate: number;
  material_cost: number;
  labour_cost: number;
  total_cost: number;
  notes: string | null;
}

export interface SeedRecord extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  season_id: UUID;
  farm_id: UUID;
  allocation_id: UUID | null;
  crop_id: UUID | null;
  date: ISODate;
  variety: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_cost: number;
  supplier: string | null;
  notes: string | null;
}

export interface Harvest extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  season_id: UUID;
  farm_id: UUID;
  allocation_id: UUID | null;
  crop_id: UUID | null;
  start_date: ISODate;
  end_date: ISODate | null;
  quantity: number;
  unit: string;
  quality: HarvestQuality;
  wastage: number;
  net_quantity: number;
  labour_cost: number;
  harvest_cost: number;
  transport_cost: number;
  total_cost: number;
  notes: string | null;
}

export interface Sale extends AuditColumns, SoftDelete {
  id: UUID;
  household_id: UUID;
  season_id: UUID;
  farm_id: UUID | null;
  allocation_id: UUID | null;
  crop_id: UUID | null;
  date: ISODate;
  buyer: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  gross_amount: number;
  transport_cost: number;
  commission: number;
  other_deductions: number;
  net_amount: number;
  payment_status: PaymentStatus;
  amount_received: number;
  notes: string | null;
}

export interface AuditLog {
  id: number;
  household_id: UUID;
  table_name: string;
  record_id: UUID;
  action: 'insert' | 'update' | 'delete';
  changed_by: UUID | null;
  changed_at: ISODateTime;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

/** Table name -> row type, used by the typed query helpers. */
export interface Tables {
  households: Household;
  profiles: Profile;
  household_settings: HouseholdSettings;
  units: Unit;
  seasons: Season;
  farms: Farm;
  crops: Crop;
  farm_crop_allocations: FarmCropAllocation;
  vendors: Vendor;
  buyers: Buyer;
  expenses: Expense;
  expense_allocations: ExpenseAllocation;
  activities: Activity;
  irrigation_records: IrrigationRecord;
  spray_records: SprayRecord;
  fertilizer_records: FertilizerRecord;
  seed_records: SeedRecord;
  harvests: Harvest;
  sales: Sale;
  audit_logs: AuditLog;
}

export type TableName = keyof Tables;
