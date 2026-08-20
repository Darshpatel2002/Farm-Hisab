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
