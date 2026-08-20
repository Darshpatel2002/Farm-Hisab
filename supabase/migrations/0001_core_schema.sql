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
