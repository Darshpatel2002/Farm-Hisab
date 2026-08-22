-- =====================================================================
-- Farm Hisab - 0009 record photos
--
-- Adds an OPTIONAL photo to every operational record (activities, irrigation,
-- sprays, fertilizer, seeds, expenses, harvest, sales) so a farmer can attach
-- a bill or a field photo. The column is nullable - photos are never required.
--
-- Photos are kept in a dedicated public Storage bucket "record-photos".
-- Files are namespaced by household id so a household can only write into
-- its own folder, while reads are public (URLs are unguessable UUIDs).
-- =====================================================================

-- 1. photo_url column on each operational table -----------------------
alter table public.activities          add column if not exists photo_url text;
alter table public.irrigation_records  add column if not exists photo_url text;
alter table public.spray_records        add column if not exists photo_url text;
alter table public.fertilizer_records   add column if not exists photo_url text;
alter table public.seed_records         add column if not exists photo_url text;
alter table public.expenses             add column if not exists photo_url text;
alter table public.harvests             add column if not exists photo_url text;
alter table public.sales                add column if not exists photo_url text;

-- 2. Storage bucket ---------------------------------------------------
insert into storage.buckets (id, name, public)
values ('record-photos', 'record-photos', true)
on conflict (id) do nothing;

-- 3. Storage policies -------------------------------------------------
-- Public read (the app references files by their public URL).
drop policy if exists "record-photos read" on storage.objects;
create policy "record-photos read"
  on storage.objects for select
  using (bucket_id = 'record-photos');

-- Only signed-in users may upload, and only into their own household folder.
-- The first path segment must equal the caller's household id.
drop policy if exists "record-photos insert" on storage.objects;
create policy "record-photos insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'record-photos'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

drop policy if exists "record-photos update" on storage.objects;
create policy "record-photos update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'record-photos'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

drop policy if exists "record-photos delete" on storage.objects;
create policy "record-photos delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'record-photos'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );
