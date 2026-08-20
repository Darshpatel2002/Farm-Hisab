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
