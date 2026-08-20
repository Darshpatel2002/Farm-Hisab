-- =====================================================================
-- Farm Hisab - complete database setup
--
-- GENERATED FILE - do not edit by hand.
-- Source: supabase/migrations/*.sql  (regenerate with: npm run db:bundle)
--
-- Paste this whole file into the Supabase SQL editor and press Run.
-- It creates every table, index, constraint, trigger and Row Level Security
-- policy, plus the optional demo-data functions.
-- Running it a second time is safe.
-- =====================================================================



-- ---------------------------------------------------------------------
-- 0001_core_schema.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Farm Hisab - 0001 core schema
-- Every table is scoped to a "household" (one farming family).
-- Row Level Security (migration 0003) restricts every row to the
-- household of the signed-in user.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Households and profiles
-- ---------------------------------------------------------------------
create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'My Farm',
  invite_code  text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  full_name    text not null default '',
  role         text not null default 'member' check (role in ('admin', 'member')),
  language     text not null default 'en' check (language in ('en', 'gu')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_profiles_household on public.profiles (household_id);

-- ---------------------------------------------------------------------
-- Settings and configurable units
-- ---------------------------------------------------------------------
create table if not exists public.household_settings (
  household_id            uuid primary key references public.households (id) on delete cascade,
  currency                text not null default 'INR',
  locale                  text not null default 'en-IN',
  language                text not null default 'en' check (language in ('en', 'gu')),
  theme                   text not null default 'light' check (theme in ('light', 'dark', 'system')),
  timezone                text not null default 'Asia/Kolkata',
  default_season_id       uuid,
  default_area_unit       text not null default 'vigha',
  default_weight_unit     text not null default 'quintal',
  -- When false, a crop allocation may not exceed the remaining farm area.
  allow_area_overallocation boolean not null default false,
  -- When true, a shared expense must be fully allocated before it can be saved.
  require_full_allocation   boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Units with household-configurable conversion factors.
-- factor_to_base: area -> acre, weight -> kg, volume -> litre, time -> hour.
create table if not exists public.units (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  kind          text not null check (kind in ('area', 'weight', 'volume', 'time', 'count')),
  code          text not null,
  label_en      text not null,
  label_gu      text not null default '',
  factor_to_base numeric(18, 8) not null check (factor_to_base > 0),
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, kind, code)
);
create index if not exists idx_units_household on public.units (household_id, kind);

-- ---------------------------------------------------------------------
-- Seasons
-- ---------------------------------------------------------------------
create table if not exists public.seasons (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  year         integer not null check (year between 1900 and 2200),
  start_date   date,
  end_date     date,
  status       text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  notes        text,
  closed_at    timestamptz,
  deleted_at   timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  updated_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint seasons_date_order check (start_date is null or end_date is null or end_date >= start_date)
);
create index if not exists idx_seasons_household on public.seasons (household_id, year desc);

alter table public.household_settings
  drop constraint if exists household_settings_default_season_fkey;
alter table public.household_settings
  add constraint household_settings_default_season_fkey
  foreign key (default_season_id) references public.seasons (id) on delete set null;

-- ---------------------------------------------------------------------
-- Farms
-- ---------------------------------------------------------------------
create table if not exists public.farms (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  name            text not null,
  local_name      text not null default '',
  area            numeric(12, 4) not null check (area > 0),
  area_unit       text not null default 'vigha',
  -- Normalised area in acres, computed by the app from the household's unit factors.
  acre_equivalent numeric(12, 4) not null check (acre_equivalent > 0),
  location_notes  text,
  is_active       boolean not null default true,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_farms_household on public.farms (household_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- Crop master
-- ---------------------------------------------------------------------
create table if not exists public.crops (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  name_gu      text not null default '',
  category     text not null default 'other',
  default_unit text not null default 'quintal',
  notes        text,
  is_active    boolean not null default true,
  deleted_at   timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  updated_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_crops_household on public.crops (household_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- Farm <-> crop allocation (a farm may carry several crops in a season,
-- and one crop may span several farms)
-- ---------------------------------------------------------------------
create table if not exists public.farm_crop_allocations (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  farm_id               uuid not null references public.farms (id) on delete cascade,
  season_id             uuid not null references public.seasons (id) on delete cascade,
  crop_id               uuid not null references public.crops (id) on delete restrict,
  area                  numeric(12, 4) not null check (area > 0),
  area_unit             text not null default 'vigha',
  acre_equivalent       numeric(12, 4) not null check (acre_equivalent > 0),
  land_prep_date        date,
  sowing_date           date,
  germination_date      date,
  expected_harvest_date date,
  actual_harvest_date   date,
  status                text not null default 'planned'
                        check (status in ('planned', 'sown', 'growing', 'harvesting', 'harvested', 'sold', 'failed')),
  notes                 text,
  deleted_at            timestamptz,
  created_by            uuid references auth.users (id) on delete set null,
  updated_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint allocation_harvest_after_sowing
    check (sowing_date is null or actual_harvest_date is null or actual_harvest_date >= sowing_date)
);
create index if not exists idx_alloc_farm on public.farm_crop_allocations (farm_id);
create index if not exists idx_alloc_season on public.farm_crop_allocations (season_id);
create index if not exists idx_alloc_crop on public.farm_crop_allocations (crop_id);
create index if not exists idx_alloc_household_season on public.farm_crop_allocations (household_id, season_id);

-- ---------------------------------------------------------------------
-- Vendors and buyers
-- ---------------------------------------------------------------------
create table if not exists public.vendors (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  phone        text,
  notes        text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_vendors_household on public.vendors (household_id);

create table if not exists public.buyers (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  phone        text,
  notes        text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_buyers_household on public.buyers (household_id);



-- ---------------------------------------------------------------------
-- 0002_operations_schema.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Farm Hisab - 0002 operations, money and production
--
-- ACCOUNTING RULE
--   public.expenses            = the single source of truth for "how much was spent"
--   public.expense_allocations = how that same money is split across farms/crops
--
--   Grand totals are read from expenses.amount.
--   Per-farm / per-crop totals are read from expense_allocations.amount.
--   The two are NEVER added together, so a shared expense is never double counted.
--
--   Operational records (spray, irrigation, fertilizer, seed, activity,
--   harvest cost) do not add cost on their own. A trigger mirrors their cost
--   into exactly one linked row in expenses (source_type + source_id).
-- =====================================================================

create table if not exists public.expenses (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  season_id         uuid not null references public.seasons (id) on delete cascade,
  date              date not null default (now() at time zone 'Asia/Kolkata')::date,
  category          text not null default 'other',
  description       text not null default '',
  amount            numeric(14, 2) not null check (amount >= 0),
  -- Direct expenses point straight at a farm (and optionally a crop allocation).
  -- Shared expenses leave these null and are split through expense_allocations.
  farm_id           uuid references public.farms (id) on delete set null,
  allocation_id     uuid references public.farm_crop_allocations (id) on delete set null,
  crop_id           uuid references public.crops (id) on delete set null,
  allocation_method text not null default 'direct' check (allocation_method in ('direct', 'manual', 'area', 'equal')),
  vendor            text,
  quantity          numeric(14, 3) check (quantity is null or quantity >= 0),
  unit              text,
  payment_method    text not null default 'cash' check (payment_method in ('cash', 'upi', 'bank', 'credit', 'other')),
  notes             text,
  source_type       text not null default 'manual'
                    check (source_type in ('manual', 'spray', 'irrigation', 'fertilizer', 'seed', 'activity', 'harvest', 'sale')),
  source_id         uuid,
  deleted_at        timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint expenses_direct_needs_farm
    check (allocation_method <> 'direct' or farm_id is not null or source_type <> 'manual')
);
create unique index if not exists uq_expense_source on public.expenses (source_type, source_id) where source_id is not null;
create index if not exists idx_expenses_household_season on public.expenses (household_id, season_id, date desc);
create index if not exists idx_expenses_farm on public.expenses (farm_id);
create index if not exists idx_expenses_allocation on public.expenses (allocation_id);
create index if not exists idx_expenses_date on public.expenses (date);
create index if not exists idx_expenses_created_by on public.expenses (created_by);
create index if not exists idx_expenses_category on public.expenses (household_id, category);

create table if not exists public.expense_allocations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  expense_id    uuid not null references public.expenses (id) on delete cascade,
  farm_id       uuid not null references public.farms (id) on delete cascade,
  allocation_id uuid references public.farm_crop_allocations (id) on delete set null,
  amount        numeric(14, 2) not null check (amount >= 0),
  basis         text not null default 'manual' check (basis in ('direct', 'manual', 'area', 'equal')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_expalloc_expense on public.expense_allocations (expense_id);
create index if not exists idx_expalloc_farm on public.expense_allocations (farm_id);
create index if not exists idx_expalloc_allocation on public.expense_allocations (allocation_id);

-- ---------------------------------------------------------------------
-- Generic activity log (land prep, sowing, labour, transport, ...)
-- ---------------------------------------------------------------------
create table if not exists public.activities (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  season_id     uuid not null references public.seasons (id) on delete cascade,
  farm_id       uuid not null references public.farms (id) on delete cascade,
  allocation_id uuid references public.farm_crop_allocations (id) on delete set null,
  date          date not null default (now() at time zone 'Asia/Kolkata')::date,
  activity_type text not null default 'other',
  description   text not null default '',
  quantity      numeric(14, 3) check (quantity is null or quantity >= 0),
  unit          text,
  cost          numeric(14, 2) not null default 0 check (cost >= 0),
  labour_days   numeric(10, 2) check (labour_days is null or labour_days >= 0),
  tractor_hours numeric(10, 2) check (tractor_hours is null or tractor_hours >= 0),
  vendor        text,
  notes         text,
  deleted_at    timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  updated_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_activities_season on public.activities (household_id, season_id, date desc);
create index if not exists idx_activities_farm on public.activities (farm_id);
create index if not exists idx_activities_allocation on public.activities (allocation_id);
create index if not exists idx_activities_created_by on public.activities (created_by);

-- ---------------------------------------------------------------------
-- Irrigation
-- ---------------------------------------------------------------------
create table if not exists public.irrigation_records (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  season_id         uuid not null references public.seasons (id) on delete cascade,
  farm_id           uuid not null references public.farms (id) on delete cascade,
  allocation_id     uuid references public.farm_crop_allocations (id) on delete set null,
  date              date not null default (now() at time zone 'Asia/Kolkata')::date,
  irrigation_number integer check (irrigation_number is null or irrigation_number > 0),
  water_source      text not null default 'borewell' check (water_source in ('borewell', 'canal', 'well', 'rain', 'other')),
  hours             numeric(10, 2) check (hours is null or hours >= 0),
  cost              numeric(14, 2) not null default 0 check (cost >= 0),
  notes             text,
  deleted_at        timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_irrigation_season on public.irrigation_records (household_id, season_id, date desc);
create index if not exists idx_irrigation_farm on public.irrigation_records (farm_id);
create index if not exists idx_irrigation_allocation on public.irrigation_records (allocation_id);

-- ---------------------------------------------------------------------
-- Spray / medicine. farm_id may be null for a crop-wide combined spray
-- that is later split across farms through expense_allocations.
-- ---------------------------------------------------------------------
create table if not exists public.spray_records (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  season_id         uuid not null references public.seasons (id) on delete cascade,
  farm_id           uuid references public.farms (id) on delete cascade,
  allocation_id     uuid references public.farm_crop_allocations (id) on delete set null,
  crop_id           uuid references public.crops (id) on delete set null,
  scope             text not null default 'farm' check (scope in ('farm', 'crop', 'season')),
  date              date not null default (now() at time zone 'Asia/Kolkata')::date,
  spray_number      integer check (spray_number is null or spray_number > 0),
  product_name      text not null default '',
  purpose           text not null default 'pesticide'
                    check (purpose in ('pesticide', 'fungicide', 'herbicide', 'insecticide', 'growth', 'nutrient', 'other')),
  quantity          numeric(14, 3) check (quantity is null or quantity >= 0),
  unit              text not null default 'ml',
  rate              numeric(14, 2) check (rate is null or rate >= 0),
  material_cost     numeric(14, 2) not null default 0 check (material_cost >= 0),
  labour_cost       numeric(14, 2) not null default 0 check (labour_cost >= 0),
  application_cost  numeric(14, 2) not null default 0 check (application_cost >= 0),
  total_cost        numeric(14, 2) generated always as (material_cost + labour_cost + application_cost) stored,
  notes             text,
  deleted_at        timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint spray_scope_target check (
    (scope = 'farm' and farm_id is not null) or
    (scope = 'crop' and crop_id is not null) or
    (scope = 'season')
  )
);
create index if not exists idx_spray_season on public.spray_records (household_id, season_id, date desc);
create index if not exists idx_spray_farm on public.spray_records (farm_id);
create index if not exists idx_spray_allocation on public.spray_records (allocation_id);
create index if not exists idx_spray_crop on public.spray_records (crop_id);

-- ---------------------------------------------------------------------
-- Fertilizer
-- ---------------------------------------------------------------------
create table if not exists public.fertilizer_records (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  season_id      uuid not null references public.seasons (id) on delete cascade,
  farm_id        uuid not null references public.farms (id) on delete cascade,
  allocation_id  uuid references public.farm_crop_allocations (id) on delete set null,
  date           date not null default (now() at time zone 'Asia/Kolkata')::date,
  product_name   text not null default '',
  quantity       numeric(14, 3) not null default 0 check (quantity >= 0),
  unit           text not null default 'kg',
  rate           numeric(14, 2) not null default 0 check (rate >= 0),
  material_cost  numeric(14, 2) not null default 0 check (material_cost >= 0),
  labour_cost    numeric(14, 2) not null default 0 check (labour_cost >= 0),
  total_cost     numeric(14, 2) generated always as (material_cost + labour_cost) stored,
  notes          text,
  deleted_at     timestamptz,
  created_by     uuid references auth.users (id) on delete set null,
  updated_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_fert_season on public.fertilizer_records (household_id, season_id, date desc);
create index if not exists idx_fert_farm on public.fertilizer_records (farm_id);

-- ---------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------
create table if not exists public.seed_records (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  season_id      uuid not null references public.seasons (id) on delete cascade,
  farm_id        uuid not null references public.farms (id) on delete cascade,
  allocation_id  uuid references public.farm_crop_allocations (id) on delete set null,
  crop_id        uuid references public.crops (id) on delete set null,
  date           date not null default (now() at time zone 'Asia/Kolkata')::date,
  variety        text not null default '',
  quantity       numeric(14, 3) not null default 0 check (quantity >= 0),
  unit           text not null default 'kg',
  price_per_unit numeric(14, 2) not null default 0 check (price_per_unit >= 0),
  total_cost     numeric(14, 2) generated always as (round(quantity * price_per_unit, 2)) stored,
  supplier       text,
  notes          text,
  deleted_at     timestamptz,
  created_by     uuid references auth.users (id) on delete set null,
  updated_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_seed_season on public.seed_records (household_id, season_id, date desc);
create index if not exists idx_seed_farm on public.seed_records (farm_id);

-- ---------------------------------------------------------------------
-- Harvest
-- ---------------------------------------------------------------------
create table if not exists public.harvests (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  season_id      uuid not null references public.seasons (id) on delete cascade,
  farm_id        uuid not null references public.farms (id) on delete cascade,
  allocation_id  uuid references public.farm_crop_allocations (id) on delete set null,
  crop_id        uuid references public.crops (id) on delete set null,
  start_date     date not null default (now() at time zone 'Asia/Kolkata')::date,
  end_date       date,
  quantity       numeric(14, 3) not null check (quantity >= 0),
  unit           text not null default 'quintal',
  quality        text not null default 'a' check (quality in ('a', 'b', 'c', 'mixed')),
  wastage        numeric(14, 3) not null default 0 check (wastage >= 0),
  net_quantity   numeric(14, 3) generated always as (greatest(quantity - wastage, 0)) stored,
  labour_cost    numeric(14, 2) not null default 0 check (labour_cost >= 0),
  harvest_cost   numeric(14, 2) not null default 0 check (harvest_cost >= 0),
  transport_cost numeric(14, 2) not null default 0 check (transport_cost >= 0),
  total_cost     numeric(14, 2) generated always as (labour_cost + harvest_cost + transport_cost) stored,
  notes          text,
  deleted_at     timestamptz,
  created_by     uuid references auth.users (id) on delete set null,
  updated_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint harvest_date_order check (end_date is null or end_date >= start_date),
  constraint harvest_wastage_within_quantity check (wastage <= quantity)
);
create index if not exists idx_harvest_season on public.harvests (household_id, season_id, start_date desc);
create index if not exists idx_harvest_farm on public.harvests (farm_id);
create index if not exists idx_harvest_allocation on public.harvests (allocation_id);
create index if not exists idx_harvest_crop on public.harvests (crop_id);

-- ---------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------
create table if not exists public.sales (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  season_id        uuid not null references public.seasons (id) on delete cascade,
  farm_id          uuid references public.farms (id) on delete set null,
  allocation_id    uuid references public.farm_crop_allocations (id) on delete set null,
  crop_id          uuid references public.crops (id) on delete set null,
  date             date not null default (now() at time zone 'Asia/Kolkata')::date,
  buyer            text not null default '',
  quantity         numeric(14, 3) not null check (quantity >= 0),
  unit             text not null default 'quintal',
  price_per_unit   numeric(14, 2) not null check (price_per_unit >= 0),
  gross_amount     numeric(14, 2) generated always as (round(quantity * price_per_unit, 2)) stored,
  transport_cost   numeric(14, 2) not null default 0 check (transport_cost >= 0),
  commission       numeric(14, 2) not null default 0 check (commission >= 0),
  other_deductions numeric(14, 2) not null default 0 check (other_deductions >= 0),
  net_amount       numeric(14, 2) generated always as
                     (round(quantity * price_per_unit, 2) - transport_cost - commission - other_deductions) stored,
  payment_status   text not null default 'received' check (payment_status in ('received', 'pending', 'partial')),
  amount_received  numeric(14, 2) not null default 0 check (amount_received >= 0),
  notes            text,
  deleted_at       timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_sales_season on public.sales (household_id, season_id, date desc);
create index if not exists idx_sales_farm on public.sales (farm_id);
create index if not exists idx_sales_allocation on public.sales (allocation_id);
create index if not exists idx_sales_crop on public.sales (crop_id);

-- ---------------------------------------------------------------------
-- Audit log for financial records
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id           bigserial primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  table_name   text not null,
  record_id    uuid not null,
  action       text not null check (action in ('insert', 'update', 'delete')),
  changed_by   uuid references auth.users (id) on delete set null,
  changed_at   timestamptz not null default now(),
  old_data     jsonb,
  new_data     jsonb
);
create index if not exists idx_audit_household on public.audit_logs (household_id, changed_at desc);
create index if not exists idx_audit_record on public.audit_logs (table_name, record_id);



-- ---------------------------------------------------------------------
-- 0003_functions_triggers.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Farm Hisab - 0003 functions and triggers
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers used by RLS policies. SECURITY DEFINER avoids recursive policy
-- evaluation when a policy on profiles needs to read profiles.
-- ---------------------------------------------------------------------
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'households', 'profiles', 'household_settings', 'units', 'seasons', 'farms', 'crops',
    'farm_crop_allocations', 'vendors', 'buyers', 'expenses', 'expense_allocations',
    'activities', 'irrigation_records', 'spray_records', 'fertilizer_records',
    'seed_records', 'harvests', 'sales'
  ]
  loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- New household bootstrap: settings + default configurable units
-- ---------------------------------------------------------------------
create or replace function public.seed_household_defaults(p_household uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_settings (household_id)
  values (p_household)
  on conflict (household_id) do nothing;

  insert into public.units (household_id, kind, code, label_en, label_gu, factor_to_base, sort_order)
  values
    -- Area units convert to ACRE. These factors are editable per household
    -- because "vigha" and "bigha" differ from region to region.
    (p_household, 'area', 'acre',    'Acre',    'એકર',      1,          1),
    (p_household, 'area', 'vigha',   'Vigha',   'વીઘા',     0.3951,     2),
    (p_household, 'area', 'guntha',  'Guntha',  'ગુંઠા',    0.025,      3),
    (p_household, 'area', 'bigha',   'Bigha',   'બીઘા',     0.625,      4),
    (p_household, 'area', 'hectare', 'Hectare', 'હેક્ટર',   2.47105,    5),
    -- Weight units convert to KG.
    (p_household, 'weight', 'kg',      'Kilogram', 'કિલો',    1,        1),
    (p_household, 'weight', 'quintal', 'Quintal',  'ક્વિન્ટલ', 100,      2),
    (p_household, 'weight', 'ton',     'Ton',      'ટન',      1000,     3),
    (p_household, 'weight', 'bag',     'Bag',      'બોરી',    50,       4),
    (p_household, 'weight', 'packet',  'Packet',   'પેકેટ',   1,        5),
    -- Volume units convert to LITRE.
    (p_household, 'volume', 'litre', 'Litre',      'લિટર',   1,        1),
    (p_household, 'volume', 'ml',    'Millilitre', 'મિ.લી.', 0.001,    2),
    -- Time units convert to HOUR.
    (p_household, 'time', 'hour', 'Hour', 'કલાક', 1, 1),
    (p_household, 'time', 'day',  'Day',  'દિવસ', 8, 2)
  on conflict (household_id, kind, code) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Signup: create (or join) a household and a profile.
-- A user joins an existing family by passing invite_code in the signup
-- metadata; otherwise a brand new household is created and the user
-- becomes its admin.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite    text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')), '');
  v_name      text := coalesce(nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''), split_part(new.email, '@', 1));
  v_household uuid;
  v_role      text := 'member';
begin
  if v_invite is not null then
    select id into v_household from public.households where invite_code = upper(v_invite);
  end if;

  if v_household is null then
    insert into public.households (name)
    values (coalesce(nullif(trim(coalesce(new.raw_user_meta_data ->> 'household_name', '')), ''), v_name || '''s Farm'))
    returning id into v_household;
    v_role := 'admin';
    perform public.seed_household_defaults(v_household);
  end if;

  insert into public.profiles (id, household_id, full_name, role)
  values (new.id, v_household, v_name, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Direct expenses automatically own exactly one allocation row so that
-- per-farm reporting can always read from expense_allocations.
-- ---------------------------------------------------------------------
create or replace function public.sync_direct_expense_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.allocation_method = 'direct' then
    delete from public.expense_allocations where expense_id = new.id;
    if new.farm_id is not null and new.deleted_at is null and new.amount > 0 then
      insert into public.expense_allocations (household_id, expense_id, farm_id, allocation_id, amount, basis)
      values (new.household_id, new.id, new.farm_id, new.allocation_id, new.amount, 'direct');
    end if;
  elsif new.deleted_at is not null then
    -- A soft-deleted shared expense must stop contributing to farm reports.
    delete from public.expense_allocations where expense_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_expense_direct_allocation on public.expenses;
create trigger trg_expense_direct_allocation
  after insert or update of amount, farm_id, allocation_id, allocation_method, deleted_at, household_id
  on public.expenses
  for each row execute function public.sync_direct_expense_allocation();

-- Allocations may never distribute more money than the expense itself.
create or replace function public.validate_expense_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount    numeric(14, 2);
  v_allocated numeric(14, 2);
begin
  select amount into v_amount from public.expenses where id = new.expense_id;
  if v_amount is null then
    raise exception 'Expense % not found', new.expense_id;
  end if;

  select coalesce(sum(amount), 0) into v_allocated
  from public.expense_allocations
  where expense_id = new.expense_id and id <> new.id;

  if v_allocated + new.amount > v_amount + 0.01 then
    raise exception 'Allocated total (%) cannot exceed the expense amount (%)', v_allocated + new.amount, v_amount
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_expense_allocation on public.expense_allocations;
create trigger trg_validate_expense_allocation
  before insert or update on public.expense_allocations
  for each row execute function public.validate_expense_allocation();

-- ---------------------------------------------------------------------
-- Operational records mirror their cost into ONE linked expense row.
-- This keeps "total spent" in a single table and prevents double counting.
-- ---------------------------------------------------------------------
create or replace function public.upsert_source_expense(
  p_household   uuid,
  p_season      uuid,
  p_source_type text,
  p_source_id   uuid,
  p_date        date,
  p_category    text,
  p_description text,
  p_amount      numeric,
  p_farm        uuid,
  p_allocation  uuid,
  p_crop        uuid,
  p_method      text,
  p_vendor      text,
  p_quantity    numeric,
  p_unit        text,
  p_deleted     timestamptz,
  p_user        uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from public.expenses where source_type = p_source_type and source_id = p_source_id;

  if v_id is null then
    insert into public.expenses (
      household_id, season_id, date, category, description, amount, farm_id, allocation_id, crop_id,
      allocation_method, vendor, quantity, unit, source_type, source_id, deleted_at, created_by, updated_by
    ) values (
      p_household, p_season, p_date, p_category, p_description, p_amount, p_farm, p_allocation, p_crop,
      p_method, p_vendor, p_quantity, p_unit, p_source_type, p_source_id, p_deleted, p_user, p_user
    )
    returning id into v_id;
  else
    update public.expenses set
      season_id = p_season, date = p_date, category = p_category, description = p_description,
      amount = p_amount, farm_id = p_farm, allocation_id = p_allocation, crop_id = p_crop,
      allocation_method = p_method, vendor = p_vendor, quantity = p_quantity, unit = p_unit,
      deleted_at = p_deleted, updated_by = p_user
    where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.sync_spray_expense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_source_expense(
    new.household_id, new.season_id, 'spray', new.id, new.date, 'spray',
    coalesce(nullif(new.product_name, ''), 'Spray'), new.total_cost,
    new.farm_id, new.allocation_id, new.crop_id,
    case when new.scope = 'farm' then 'direct' else 'area' end,
    null, new.quantity, new.unit, new.deleted_at, new.updated_by
  );
  return null;
end;
$$;
drop trigger if exists trg_spray_expense on public.spray_records;
create trigger trg_spray_expense after insert or update on public.spray_records
  for each row execute function public.sync_spray_expense();

create or replace function public.sync_irrigation_expense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_source_expense(
    new.household_id, new.season_id, 'irrigation', new.id, new.date, 'irrigation',
    coalesce('Irrigation #' || new.irrigation_number, 'Irrigation'), new.cost,
    new.farm_id, new.allocation_id, null, 'direct', null, new.hours, 'hour', new.deleted_at, new.updated_by
  );
  return null;
end;
$$;
drop trigger if exists trg_irrigation_expense on public.irrigation_records;
create trigger trg_irrigation_expense after insert or update on public.irrigation_records
  for each row execute function public.sync_irrigation_expense();

create or replace function public.sync_fertilizer_expense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_source_expense(
    new.household_id, new.season_id, 'fertilizer', new.id, new.date, 'fertilizer',
    coalesce(nullif(new.product_name, ''), 'Fertilizer'), new.total_cost,
    new.farm_id, new.allocation_id, null, 'direct', null, new.quantity, new.unit, new.deleted_at, new.updated_by
  );
  return null;
end;
$$;
drop trigger if exists trg_fertilizer_expense on public.fertilizer_records;
create trigger trg_fertilizer_expense after insert or update on public.fertilizer_records
  for each row execute function public.sync_fertilizer_expense();

create or replace function public.sync_seed_expense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_source_expense(
    new.household_id, new.season_id, 'seed', new.id, new.date, 'seeds',
    coalesce(nullif(new.variety, ''), 'Seed'), new.total_cost,
    new.farm_id, new.allocation_id, new.crop_id, 'direct', new.supplier, new.quantity, new.unit,
    new.deleted_at, new.updated_by
  );
  return null;
end;
$$;
drop trigger if exists trg_seed_expense on public.seed_records;
create trigger trg_seed_expense after insert or update on public.seed_records
  for each row execute function public.sync_seed_expense();

create or replace function public.sync_activity_expense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_source_expense(
    new.household_id, new.season_id, 'activity', new.id, new.date,
    case
      when new.activity_type in ('tractor', 'ploughing', 'rotavator', 'land_preparation') then 'land_preparation'
      when new.activity_type in ('sowing', 'seeding') then 'sowing'
      when new.activity_type = 'labour' then 'labour'
      when new.activity_type = 'harvesting' then 'harvesting'
      when new.activity_type = 'transport' then 'transportation'
      else 'other'
    end,
    coalesce(nullif(new.description, ''), new.activity_type), new.cost,
    new.farm_id, new.allocation_id, null, 'direct', new.vendor, new.quantity, new.unit,
    new.deleted_at, new.updated_by
  );
  return null;
end;
$$;
drop trigger if exists trg_activity_expense on public.activities;
create trigger trg_activity_expense after insert or update on public.activities
  for each row execute function public.sync_activity_expense();

create or replace function public.sync_harvest_expense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_source_expense(
    new.household_id, new.season_id, 'harvest', new.id, new.start_date, 'harvesting',
    'Harvest cost', new.total_cost,
    new.farm_id, new.allocation_id, new.crop_id, 'direct', null, new.quantity, new.unit,
    new.deleted_at, new.updated_by
  );
  return null;
end;
$$;
drop trigger if exists trg_harvest_expense on public.harvests;
create trigger trg_harvest_expense after insert or update on public.harvests
  for each row execute function public.sync_harvest_expense();

-- Hard deletes of source rows remove the mirrored expense too.
create or replace function public.delete_source_expense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.expenses where source_type = tg_argv[0] and source_id = old.id;
  return old;
end;
$$;

do $$
declare r record;
begin
  for r in select * from (values
      ('spray_records', 'spray'),
      ('irrigation_records', 'irrigation'),
      ('fertilizer_records', 'fertilizer'),
      ('seed_records', 'seed'),
      ('activities', 'activity'),
      ('harvests', 'harvest')
    ) as t(tbl, src)
  loop
    execute format('drop trigger if exists trg_%s_expense_delete on public.%I', r.src, r.tbl);
    execute format(
      'create trigger trg_%s_expense_delete after delete on public.%I for each row execute function public.delete_source_expense(%L)',
      r.src, r.tbl, r.src
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Automatic 1st / 2nd / 3rd numbering for irrigation and spray
-- ---------------------------------------------------------------------
create or replace function public.assign_irrigation_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.irrigation_number is null then
    select coalesce(max(irrigation_number), 0) + 1 into new.irrigation_number
    from public.irrigation_records
    where household_id = new.household_id
      and season_id = new.season_id
      and deleted_at is null
      and (
        (new.allocation_id is not null and allocation_id = new.allocation_id)
        or (new.allocation_id is null and allocation_id is null and farm_id = new.farm_id)
      );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_irrigation_number on public.irrigation_records;
create trigger trg_irrigation_number before insert on public.irrigation_records
  for each row execute function public.assign_irrigation_number();

create or replace function public.assign_spray_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.spray_number is null then
    select coalesce(max(spray_number), 0) + 1 into new.spray_number
    from public.spray_records
    where household_id = new.household_id
      and season_id = new.season_id
      and deleted_at is null
      and (
        (new.allocation_id is not null and allocation_id = new.allocation_id)
        or (new.allocation_id is null and new.farm_id is not null and farm_id = new.farm_id)
        or (new.allocation_id is null and new.farm_id is null and crop_id is not distinct from new.crop_id)
      );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_spray_number on public.spray_records;
create trigger trg_spray_number before insert on public.spray_records
  for each row execute function public.assign_spray_number();

-- ---------------------------------------------------------------------
-- Audit trail for the financial tables
-- ---------------------------------------------------------------------
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (household_id, table_name, record_id, action, changed_by, old_data)
    values (old.household_id, tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (household_id, table_name, record_id, action, changed_by, old_data, new_data)
    values (new.household_id, tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_logs (household_id, table_name, record_id, action, changed_by, new_data)
    values (new.household_id, tg_table_name, new.id, 'insert', auth.uid(), to_jsonb(new));
    return new;
  end if;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['expenses', 'harvests', 'sales'] loop
    execute format('drop trigger if exists trg_%s_audit on public.%I', t, t);
    execute format(
      'create trigger trg_%s_audit after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      t, t
    );
  end loop;
end;
$$;



-- ---------------------------------------------------------------------
-- 0004_rls_policies.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Farm Hisab - 0004 Row Level Security
--
-- Everything is scoped to the signed-in user's household. Nothing in this
-- schema is readable without an authenticated session.
-- =====================================================================

-- Households -----------------------------------------------------------
alter table public.households enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (id = public.current_household_id());

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (id = public.current_household_id() and public.is_admin())
  with check (id = public.current_household_id());

-- Profiles -------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (household_id = public.current_household_id());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or (household_id = public.current_household_id() and public.is_admin()))
  with check (household_id = public.current_household_id());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (household_id = public.current_household_id() and public.is_admin() and id <> auth.uid());

-- Audit log: readable by the household, written only by SECURITY DEFINER triggers.
alter table public.audit_logs enable row level security;

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select to authenticated
  using (household_id = public.current_household_id());

-- ---------------------------------------------------------------------
-- Standard household-scoped tables.
--   admin_write  -> only the owner/admin may insert, update or delete
--   member_write -> every family member may insert and update;
--                   delete is limited to the record's author or an admin
-- ---------------------------------------------------------------------
do $$
declare
  admin_write  text[] := array['household_settings', 'units', 'seasons', 'farms', 'crops', 'farm_crop_allocations'];
  member_write text[] := array['vendors', 'buyers', 'expenses', 'expense_allocations', 'activities',
                               'irrigation_records', 'spray_records', 'fertilizer_records',
                               'seed_records', 'harvests', 'sales'];
  t            text;
  has_author   boolean;
begin
  foreach t in array admin_write || member_write loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (household_id = public.current_household_id())',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    if t = any (admin_write) then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (household_id = public.current_household_id() and public.is_admin())',
        t || '_insert', t
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (household_id = public.current_household_id() and public.is_admin()) with check (household_id = public.current_household_id())',
        t || '_update', t
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (household_id = public.current_household_id() and public.is_admin())',
        t || '_delete', t
      );
    else
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (household_id = public.current_household_id())',
        t || '_insert', t
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (household_id = public.current_household_id()) with check (household_id = public.current_household_id())',
        t || '_update', t
      );

      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'created_by'
      ) into has_author;

      if has_author then
        execute format(
          'create policy %I on public.%I for delete to authenticated using (household_id = public.current_household_id() and (public.is_admin() or created_by = auth.uid()))',
          t || '_delete', t
        );
      else
        execute format(
          'create policy %I on public.%I for delete to authenticated using (household_id = public.current_household_id())',
          t || '_delete', t
        );
      end if;
    end if;
  end loop;
end;
$$;

-- The anon role must never reach application data.
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;



-- ---------------------------------------------------------------------
-- 0005_demo_data.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Farm Hisab - 0005 demo data
--
-- Demo rows are always suffixed with "(Demo)" so they are obvious in the
-- UI and can be removed in one click from Settings -> Demo data.
-- The numbers are realistic but entirely fictional; no real personal
-- information is stored here.
-- =====================================================================

create or replace function public.load_demo_data(p_household uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household   uuid := coalesce(p_household, public.current_household_id());
  v_user        uuid := auth.uid();
  farm_names    text[] := array[
    'Hirabhavaru Khetar', 'Maar', 'Maga Varu', 'Vadivala Khetar', 'Nava Khetar',
    'Talav Kanthe', 'Ambavadi', 'Nadi Paase', 'Ganeshpura', 'Kuva Vadu',
    'Dhora Vadu', 'Pipal Vadu', 'Rasta Vadu', 'Uparvas', 'Sim Vadu'];
  farm_areas    numeric[] := array[2.5, 3.0, 1.75, 4.0, 2.0, 1.5, 3.5, 2.25, 1.0, 2.75, 3.25, 1.25, 2.0, 4.5, 1.8];
  farm_units    text[]    := array['vigha','acre','vigha','vigha','acre','vigha','vigha','acre','vigha','vigha','acre','vigha','vigha','vigha','acre'];
  crop_names    text[] := array['Groundnut', 'Cotton', 'Wheat', 'Bajra', 'Castor'];
  crop_gu       text[] := array['મગફળી', 'કપાસ', 'ઘઉં', 'બાજરી', 'એરંડા'];
  crop_yield    numeric[] := array[9.0, 7.5, 14.0, 11.0, 8.0];   -- quintal per acre
  crop_price    numeric[] := array[6200, 7400, 2400, 2100, 5600]; -- rupees per quintal
  crop_cost     numeric[] := array[18000, 26000, 15000, 11000, 16000]; -- rupees per acre
  v_season_ids  uuid[] := '{}';
  v_crop_ids    uuid[] := '{}';
  v_farm_ids    uuid[] := '{}';
  v_id          uuid;
  v_alloc       uuid;
  v_season      uuid;
  v_acre        numeric;
  v_factor      numeric;
  v_sowing      date;
  v_year        integer;
  s             integer;
  i             integer;
  j             integer;
  k             integer;
  v_crop_idx    integer;
  v_qty         numeric;
  v_uplift      numeric;
begin
  if v_household is null then
    raise exception 'No household found for the current user';
  end if;

  perform public.seed_household_defaults(v_household);

  -- Seasons: two Kharif seasons so year-over-year reports have data.
  for s in 1..2 loop
    v_year := 2025 + s;
    insert into public.seasons (household_id, name, year, start_date, end_date, status, notes, created_by, updated_by)
    values (v_household, v_year || ' Kharif (Demo)', v_year,
            make_date(v_year, 6, 1), make_date(v_year, 11, 30),
            case when s = 1 then 'completed' else 'active' end,
            'Demo season', v_user, v_user)
    returning id into v_id;
    v_season_ids := v_season_ids || v_id;
  end loop;

  -- Crops
  for i in 1..array_length(crop_names, 1) loop
    insert into public.crops (household_id, name, name_gu, category, default_unit, notes, created_by, updated_by)
    values (v_household, crop_names[i] || ' (Demo)', crop_gu[i],
            case when crop_names[i] in ('Wheat', 'Bajra') then 'cereal'
                 when crop_names[i] = 'Groundnut' then 'oilseed'
                 when crop_names[i] = 'Castor' then 'oilseed'
                 else 'cash_crop' end,
            'quintal', 'Demo crop', v_user, v_user)
    returning id into v_id;
    v_crop_ids := v_crop_ids || v_id;
  end loop;

  -- Farms
  for i in 1..array_length(farm_names, 1) loop
    select factor_to_base into v_factor from public.units
      where household_id = v_household and kind = 'area' and code = farm_units[i];
    v_acre := round(farm_areas[i] * coalesce(v_factor, 1), 4);
    insert into public.farms (household_id, name, local_name, area, area_unit, acre_equivalent, location_notes, created_by, updated_by)
    values (v_household, farm_names[i] || ' (Demo)', farm_names[i], farm_areas[i], farm_units[i], v_acre,
            'Demo farm near Kadoli', v_user, v_user)
    returning id into v_id;
    v_farm_ids := v_farm_ids || v_id;
  end loop;

  -- Allocations, operations, harvest and sales for both seasons.
  for s in 1..2 loop
    v_season := v_season_ids[s];
    v_year := 2025 + s;
    v_uplift := case when s = 1 then 1.0 else 1.12 end; -- second season performs slightly better

    for i in 1..array_length(v_farm_ids, 1) loop
      -- Larger farms carry two crops, smaller farms one.
      for j in 1..(case when farm_areas[i] >= 3 then 2 else 1 end) loop
        v_crop_idx := 1 + ((i + j + s) % array_length(v_crop_ids, 1));
        select acre_equivalent into v_acre from public.farms where id = v_farm_ids[i];
        v_acre := round(v_acre / (case when farm_areas[i] >= 3 then 2 else 1 end), 4);
        v_sowing := make_date(v_year, 6, 8 + (i % 12));

        insert into public.farm_crop_allocations (
          household_id, farm_id, season_id, crop_id, area, area_unit, acre_equivalent,
          land_prep_date, sowing_date, expected_harvest_date, actual_harvest_date, status, notes, created_by, updated_by)
        values (
          v_household, v_farm_ids[i], v_season, v_crop_ids[v_crop_idx], v_acre, 'acre', v_acre,
          v_sowing - 10, v_sowing, v_sowing + 110,
          case when s = 1 then v_sowing + 112 else null end,
          case when s = 1 then 'sold' else 'growing' end,
          'Demo allocation', v_user, v_user)
        returning id into v_alloc;

        -- Seed
        insert into public.seed_records (household_id, season_id, farm_id, allocation_id, crop_id, date, variety,
                                         quantity, unit, price_per_unit, supplier, notes, created_by, updated_by)
        values (v_household, v_season, v_farm_ids[i], v_alloc, v_crop_ids[v_crop_idx], v_sowing,
                'Local variety (Demo)', round(v_acre * 40, 2), 'kg', 95, 'Kadoli Krushi Kendra (Demo)',
                'Demo seed', v_user, v_user);

        -- Land preparation + sowing labour
        insert into public.activities (household_id, season_id, farm_id, allocation_id, date, activity_type,
                                       description, cost, tractor_hours, labour_days, vendor, notes, created_by, updated_by)
        values
          (v_household, v_season, v_farm_ids[i], v_alloc, v_sowing - 10, 'land_preparation',
           'Tractor ploughing (Demo)', round(v_acre * 1800, 2), round(v_acre * 1.5, 2), null,
           'Tractor owner (Demo)', 'Demo activity', v_user, v_user),
          (v_household, v_season, v_farm_ids[i], v_alloc, v_sowing, 'sowing',
           'Sowing labour (Demo)', round(v_acre * 1200, 2), null, round(v_acre * 2, 2),
           null, 'Demo activity', v_user, v_user);

        -- Fertilizer
        insert into public.fertilizer_records (household_id, season_id, farm_id, allocation_id, date, product_name,
                                               quantity, unit, rate, material_cost, labour_cost, notes, created_by, updated_by)
        values (v_household, v_season, v_farm_ids[i], v_alloc, v_sowing + 15, 'DAP (Demo)',
                round(v_acre * 50, 2), 'kg', 28, round(v_acre * 50 * 28, 2), round(v_acre * 300, 2),
                'Demo fertilizer', v_user, v_user);

        -- Irrigation: 3 to 4 events
        for k in 1..(3 + (i % 2)) loop
          insert into public.irrigation_records (household_id, season_id, farm_id, allocation_id, date,
                                                 irrigation_number, water_source, hours, cost, notes, created_by, updated_by)
          values (v_household, v_season, v_farm_ids[i], v_alloc, v_sowing + (k * 18),
                  k, case when i % 3 = 0 then 'canal' else 'borewell' end,
                  round(v_acre * 2, 2), round(v_acre * 450, 2), 'Demo irrigation', v_user, v_user);
        end loop;

        -- Sprays: 2 to 3 events
        for k in 1..(2 + (i % 2)) loop
          insert into public.spray_records (household_id, season_id, farm_id, allocation_id, crop_id, scope, date,
                                            spray_number, product_name, purpose, quantity, unit, rate,
                                            material_cost, labour_cost, application_cost, notes, created_by, updated_by)
          values (v_household, v_season, v_farm_ids[i], v_alloc, v_crop_ids[v_crop_idx], 'farm',
                  v_sowing + 25 + (k * 20), k, 'Crop medicine ' || k || ' (Demo)',
                  case when k = 1 then 'insecticide' when k = 2 then 'fungicide' else 'pesticide' end,
                  round(v_acre * 250, 2), 'ml', 1.6,
                  round(v_acre * 400, 2), round(v_acre * 150, 2), 0, 'Demo spray', v_user, v_user);
        end loop;

        -- Remaining input cost is booked as one manual expense so the demo
        -- roughly matches the per-acre cost assumptions above.
        insert into public.expenses (household_id, season_id, date, category, description, amount, farm_id,
                                     allocation_id, crop_id, allocation_method, payment_method, notes, created_by, updated_by)
        values (v_household, v_season, v_sowing + 40, 'labour', 'Weeding and general labour (Demo)',
                greatest(round(v_acre * crop_cost[v_crop_idx] * 0.18, 2), 0), v_farm_ids[i], v_alloc,
                v_crop_ids[v_crop_idx], 'direct', 'cash', 'Demo expense', v_user, v_user);

        -- Completed season gets harvest and sales.
        if s = 1 then
          v_qty := round(v_acre * crop_yield[v_crop_idx] * v_uplift * (0.85 + ((i % 5) * 0.06)), 2);
          insert into public.harvests (household_id, season_id, farm_id, allocation_id, crop_id, start_date, end_date,
                                       quantity, unit, quality, wastage, labour_cost, harvest_cost, transport_cost,
                                       notes, created_by, updated_by)
          values (v_household, v_season, v_farm_ids[i], v_alloc, v_crop_ids[v_crop_idx],
                  v_sowing + 108, v_sowing + 114, v_qty, 'quintal', 'a', round(v_qty * 0.03, 2),
                  round(v_acre * 900, 2), round(v_acre * 600, 2), round(v_acre * 350, 2),
                  'Demo harvest', v_user, v_user);

          insert into public.sales (household_id, season_id, farm_id, allocation_id, crop_id, date, buyer,
                                    quantity, unit, price_per_unit, transport_cost, commission, other_deductions,
                                    payment_status, amount_received, notes, created_by, updated_by)
          values (v_household, v_season, v_farm_ids[i], v_alloc, v_crop_ids[v_crop_idx], v_sowing + 120,
                  case when i % 2 = 0 then 'Himatnagar APMC (Demo)' else 'Local trader (Demo)' end,
                  round(v_qty * 0.97, 2), 'quintal', crop_price[v_crop_idx],
                  round(v_acre * 300, 2), round(v_qty * crop_price[v_crop_idx] * 0.01, 2), 0,
                  case when i % 6 = 0 then 'pending' else 'received' end, 0,
                  'Demo sale', v_user, v_user);
        end if;
      end loop;
    end loop;

    -- One genuinely shared expense per season, split by area across five farms.
    insert into public.expenses (household_id, season_id, date, category, description, amount,
                                 allocation_method, payment_method, vendor, notes, created_by, updated_by)
    values (v_household, v_season, make_date(v_year, 6, 5), 'tractor',
            'Shared tractor hire for five farms (Demo)', 10000, 'area', 'cash',
            'Tractor owner (Demo)', 'Demo shared expense', v_user, v_user)
    returning id into v_id;

    declare
      v_total_acre numeric := 0;
      v_alloc_sum  numeric := 0;
      v_share      numeric;
    begin
      for i in 1..5 loop
        select acre_equivalent into v_acre from public.farms where id = v_farm_ids[i];
        v_total_acre := v_total_acre + v_acre;
      end loop;
      for i in 1..5 loop
        select acre_equivalent into v_acre from public.farms where id = v_farm_ids[i];
        v_share := case when i = 5 then 10000 - v_alloc_sum else round(10000 * v_acre / v_total_acre, 2) end;
        v_alloc_sum := v_alloc_sum + v_share;
        insert into public.expense_allocations (household_id, expense_id, farm_id, amount, basis)
        values (v_household, v_id, v_farm_ids[i], v_share, 'area');
      end loop;
    end;
  end loop;

  -- Point the household at the active demo season.
  update public.household_settings
  set default_season_id = v_season_ids[2]
  where household_id = v_household;
end;
$$;

create or replace function public.remove_demo_data(p_household uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_household uuid := coalesce(p_household, public.current_household_id());
begin
  if v_household is null then
    raise exception 'No household found for the current user';
  end if;

  update public.household_settings s
  set default_season_id = null
  where s.household_id = v_household
    and s.default_season_id in (select id from public.seasons where household_id = v_household and name like '%(Demo)%');

  -- Cascades clear every dependent operational, expense and sale row.
  delete from public.seasons where household_id = v_household and name like '%(Demo)%';
  delete from public.farms   where household_id = v_household and name like '%(Demo)%';
  delete from public.crops   where household_id = v_household and name like '%(Demo)%';
end;
$$;

grant execute on function public.load_demo_data(uuid) to authenticated;
grant execute on function public.remove_demo_data(uuid) to authenticated;



-- ---------------------------------------------------------------------
-- 0006_unit_corrections.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Farm Hisab - 0006 local unit corrections
--
-- Land measures for Kadoli / Himatnagar as used by the family:
--   23 guntha  = 1 vigha
--   40.5 guntha = 1 acre
--   100 guntha = 1 hectare
-- Everything is stored relative to the base unit (acre), so the factors
-- below are derived from those three statements.
--
-- Also adds the Gujarati weight unit "Man" (1 man = 20 kg).
-- Safe to run more than once.
-- =====================================================================

-- Keep new households in step with the corrected factors.
create or replace function public.seed_household_defaults(p_household uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_settings (household_id)
  values (p_household)
  on conflict (household_id) do nothing;

  insert into public.units (household_id, kind, code, label_en, label_gu, factor_to_base, sort_order)
  values
    -- Area units convert to ACRE. These factors are editable per household
    -- because "vigha", "bigha" and "guntha" differ from region to region.
    (p_household, 'area', 'acre',    'Acre',    'એકર',    1,             1),
    (p_household, 'area', 'vigha',   'Vigha',   'વીઘા',   23.0 / 40.5,   2),
    (p_household, 'area', 'guntha',  'Guntha',  'ગુંઠા',  1.0 / 40.5,    3),
    (p_household, 'area', 'bigha',   'Bigha',   'બીઘા',   0.625,         4),
    (p_household, 'area', 'hectare', 'Hectare', 'હેક્ટર', 100.0 / 40.5,  5),
    -- Weight units convert to KG.
    (p_household, 'weight', 'kg',      'Kilogram', 'કિલો',     1,    1),
    (p_household, 'weight', 'man',     'Man',      'મણ',       20,   2),
    (p_household, 'weight', 'quintal', 'Quintal',  'ક્વિન્ટલ', 100,  3),
    (p_household, 'weight', 'ton',     'Ton',      'ટન',       1000, 4),
    (p_household, 'weight', 'bag',     'Bag',      'બોરી',     50,   5),
    (p_household, 'weight', 'packet',  'Packet',   'પેકેટ',    1,    6),
    -- Volume units convert to LITRE.
    (p_household, 'volume', 'litre', 'Litre',      'લિટર',   1,     1),
    (p_household, 'volume', 'ml',    'Millilitre', 'મિ.લી.', 0.001, 2),
    -- Time units convert to HOUR.
    (p_household, 'time', 'hour', 'Hour', 'કલાક', 1, 1),
    (p_household, 'time', 'day',  'Day',  'દિવસ', 8, 2)
  on conflict (household_id, kind, code) do nothing;
end;
$$;

-- Correct the land factors for households that already exist.
update public.units set factor_to_base = 23.0 / 40.5  where kind = 'area' and code = 'vigha';
update public.units set factor_to_base = 1.0 / 40.5   where kind = 'area' and code = 'guntha';
update public.units set factor_to_base = 100.0 / 40.5 where kind = 'area' and code = 'hectare';

-- Add "Man" to every existing household.
insert into public.units (household_id, kind, code, label_en, label_gu, factor_to_base, sort_order)
select h.id, 'weight', 'man', 'Man', 'મણ', 20, 2
from public.households h
on conflict (household_id, kind, code) do nothing;

-- Keep the weight list in a sensible order now that "Man" sits between kg and quintal.
update public.units set sort_order = 3 where kind = 'weight' and code = 'quintal';
update public.units set sort_order = 4 where kind = 'weight' and code = 'ton';
update public.units set sort_order = 5 where kind = 'weight' and code = 'bag';
update public.units set sort_order = 6 where kind = 'weight' and code = 'packet';

-- Land areas are stored twice: in the unit the user typed, and normalised to
-- acres for reporting. Recompute the normalised value with the new factors.
update public.farms f
set acre_equivalent = round(f.area * u.factor_to_base, 4)
from public.units u
where u.household_id = f.household_id and u.kind = 'area' and u.code = f.area_unit;

update public.farm_crop_allocations a
set acre_equivalent = round(a.area * u.factor_to_base, 4)
from public.units u
where u.household_id = a.household_id and u.kind = 'area' and u.code = a.area_unit;



-- ---------------------------------------------------------------------
-- 0007_cascade_safe_allocations.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Farm Hisab - 0007 make expense allocation triggers cascade-safe
--
-- Deleting a season cascades to expenses AND to crop allocations. Removing a
-- crop allocation sets expenses.allocation_id to null, which re-fires the
-- direct-allocation trigger. If the parent expense has already been deleted
-- in the same statement, the validation trigger used to raise
-- "Expense ... not found" and the whole delete failed.
--
-- Both triggers now treat a missing parent expense as "nothing to do".
-- =====================================================================

create or replace function public.validate_expense_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount    numeric(14, 2);
  v_allocated numeric(14, 2);
begin
  select amount into v_amount from public.expenses where id = new.expense_id;

  -- The parent expense is being removed in this same statement: drop the
  -- orphan allocation instead of failing the delete.
  if v_amount is null then
    return null;
  end if;

  select coalesce(sum(amount), 0) into v_allocated
  from public.expense_allocations
  where expense_id = new.expense_id and id <> new.id;

  if v_allocated + new.amount > v_amount + 0.01 then
    raise exception 'Allocated total (%) cannot exceed the expense amount (%)', v_allocated + new.amount, v_amount
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.sync_direct_expense_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip when the expense row no longer exists (cascade delete in progress).
  if not exists (select 1 from public.expenses where id = new.id) then
    return null;
  end if;

  if new.allocation_method = 'direct' then
    delete from public.expense_allocations where expense_id = new.id;
    if new.farm_id is not null and new.deleted_at is null and new.amount > 0 then
      insert into public.expense_allocations (household_id, expense_id, farm_id, allocation_id, amount, basis)
      values (new.household_id, new.id, new.farm_id, new.allocation_id, new.amount, 'direct');
    end if;
  elsif new.deleted_at is not null then
    -- A soft-deleted shared expense must stop contributing to farm reports.
    delete from public.expense_allocations where expense_id = new.id;
  end if;
  return null;
end;
$$;



-- ---------------------------------------------------------------------
-- 0008_data_cleanup.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Farm Hisab - 0008 data cleanup helpers
--
-- Deleting a crop plan does NOT cascade, because expenses, harvests and
-- sales only reference it with ON DELETE SET NULL - a farm record must
-- survive if a plan is edited. These functions remove a crop plan (or a
-- whole season, or everything) together with all of its linked rows, in the
-- order that lets the mirrored-expense triggers clean up after themselves.
--
-- All three are owner-only and always scoped to the caller's household.
-- =====================================================================

create or replace function public.assert_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_household uuid := public.current_household_id();
begin
  if v_household is null then
    raise exception 'No household for the current user' using errcode = 'check_violation';
  end if;
  if not public.is_admin() then
    raise exception 'Only the owner can delete data' using errcode = 'insufficient_privilege';
  end if;
  return v_household;
end;
$$;

-- Everything recorded for one crop on one farm in one season.
create or replace function public.delete_allocation_data(p_allocation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.assert_owner();
  v_owner     uuid;
  v_counts    jsonb := '{}'::jsonb;
  v_rows      integer;
begin
  select household_id into v_owner from public.farm_crop_allocations where id = p_allocation;
  if v_owner is null or v_owner <> v_household then
    raise exception 'Crop plan not found' using errcode = 'no_data_found';
  end if;

  -- Source records first: each one's mirrored expense is removed by its own
  -- ON DELETE trigger, so no orphan expense is left behind.
  delete from public.spray_records where allocation_id = p_allocation;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('sprays', v_rows);

  delete from public.irrigation_records where allocation_id = p_allocation;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('irrigations', v_rows);

  delete from public.fertilizer_records where allocation_id = p_allocation;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('fertilizers', v_rows);

  delete from public.seed_records where allocation_id = p_allocation;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('seeds', v_rows);

  delete from public.activities where allocation_id = p_allocation;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('activities', v_rows);

  delete from public.harvests where allocation_id = p_allocation;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('harvests', v_rows);

  delete from public.sales where allocation_id = p_allocation;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('sales', v_rows);

  -- A shared expense may also cover other farms, so only this plan's share goes.
  delete from public.expense_allocations where allocation_id = p_allocation;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('expense_shares', v_rows);

  delete from public.expenses where allocation_id = p_allocation;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('expenses', v_rows);

  delete from public.farm_crop_allocations where id = p_allocation;

  return v_counts;
end;
$$;

-- A whole season. Every table references seasons with ON DELETE CASCADE.
create or replace function public.delete_season_data(p_season uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.assert_owner();
  v_owner     uuid;
  v_rows      integer;
begin
  select household_id into v_owner from public.seasons where id = p_season;
  if v_owner is null or v_owner <> v_household then
    raise exception 'Season not found' using errcode = 'no_data_found';
  end if;

  update public.household_settings set default_season_id = null
  where household_id = v_household and default_season_id = p_season;

  delete from public.seasons where id = p_season;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('seasons', v_rows);
end;
$$;

-- Start completely fresh: removes farms, crops, seasons and every record
-- linked to them. Keeps the account, family members, settings and units.
create or replace function public.reset_household_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.assert_owner();
  v_counts    jsonb := '{}'::jsonb;
  v_rows      integer;
begin
  update public.household_settings set default_season_id = null where household_id = v_household;

  -- Seasons cascade to every operational and money row.
  delete from public.seasons where household_id = v_household;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('seasons', v_rows);

  -- Anything not tied to a season (for example a farm with no crop plan yet).
  delete from public.expense_allocations where household_id = v_household;
  delete from public.expenses where household_id = v_household;
  delete from public.spray_records where household_id = v_household;
  delete from public.irrigation_records where household_id = v_household;
  delete from public.fertilizer_records where household_id = v_household;
  delete from public.seed_records where household_id = v_household;
  delete from public.activities where household_id = v_household;
  delete from public.harvests where household_id = v_household;
  delete from public.sales where household_id = v_household;
  delete from public.farm_crop_allocations where household_id = v_household;

  delete from public.farms where household_id = v_household;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('farms', v_rows);

  delete from public.crops where household_id = v_household;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('crops', v_rows);

  delete from public.vendors where household_id = v_household;
  delete from public.buyers where household_id = v_household;
  delete from public.audit_logs where household_id = v_household;

  return v_counts;
end;
$$;

grant execute on function public.delete_allocation_data(uuid) to authenticated;
grant execute on function public.delete_season_data(uuid) to authenticated;
grant execute on function public.reset_household_data() to authenticated;
