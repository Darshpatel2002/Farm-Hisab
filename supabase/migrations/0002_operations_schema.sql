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
