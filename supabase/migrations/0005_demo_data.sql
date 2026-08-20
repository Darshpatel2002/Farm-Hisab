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
