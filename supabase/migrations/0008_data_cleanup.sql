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
