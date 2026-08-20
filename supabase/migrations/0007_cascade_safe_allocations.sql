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
