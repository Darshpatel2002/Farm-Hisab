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
