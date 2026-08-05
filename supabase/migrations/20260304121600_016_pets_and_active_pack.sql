-- Migration 016 — pet identity: extend dog_profiles + active pack + pet-photos storage
-- Additive evolution of public.dog_profiles (no parallel pets table).
-- Active pack = dog_profiles where is_active = true (multi-pet supported).
-- Private by default; public_display_enabled opts in name/avatar for trip reports.

-- ---------------------------------------------------------------------------
-- Extend dog_profiles
-- ---------------------------------------------------------------------------

alter table public.dog_profiles
  add column if not exists photo_path text,
  add column if not exists breed text,
  add column if not exists is_active boolean not null default true,
  add column if not exists public_display_enabled boolean not null default false;

comment on column public.dog_profiles.photo_path is
  'Storage object path in pet-photos bucket: {user_id}/{pet_id}/{uuid}.{ext}';
comment on column public.dog_profiles.is_active is
  'When true, pet is in the user active pack used for compatibility / Exploring with…';
comment on column public.dog_profiles.public_display_enabled is
  'Opt-in: allow public display of name + avatar on trip reports. Private by default.';

-- Existing rows stay in the active pack (Sugar & Munch fixture behavior).
update public.dog_profiles
set is_active = true
where is_active is distinct from true;

create index if not exists dog_profiles_user_active_idx
  on public.dog_profiles (user_id)
  where is_active;

create index if not exists dog_profiles_public_display_idx
  on public.dog_profiles (id)
  where public_display_enabled;

-- ---------------------------------------------------------------------------
-- RLS: keep owner CRUD; allow limited public identity read when opted in
-- ---------------------------------------------------------------------------

drop policy if exists "dog_profiles_select_own" on public.dog_profiles;
create policy "dog_profiles_select_own"
  on public.dog_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

-- Opt-in public identity (name/avatar). Prefer public_pet_identities() for safe columns.
drop policy if exists "dog_profiles_select_public_display" on public.dog_profiles;
create policy "dog_profiles_select_public_display"
  on public.dog_profiles
  for select
  to anon, authenticated
  using (public_display_enabled = true);

-- Owner insert/update/delete unchanged (recreate if dropped elsewhere)
drop policy if exists "dog_profiles_insert_own" on public.dog_profiles;
create policy "dog_profiles_insert_own"
  on public.dog_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "dog_profiles_update_own" on public.dog_profiles;
create policy "dog_profiles_update_own"
  on public.dog_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "dog_profiles_delete_own" on public.dog_profiles;
create policy "dog_profiles_delete_own"
  on public.dog_profiles
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Safe public identity RPC (name + photo only; no weight/notes/breed)
-- ---------------------------------------------------------------------------

create or replace function public.public_pet_identities(pet_ids uuid[])
returns table (
  id uuid,
  name text,
  photo_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, d.photo_path
  from public.dog_profiles d
  where d.public_display_enabled = true
    and d.id = any (pet_ids);
$$;

revoke all on function public.public_pet_identities(uuid[]) from public;
grant execute on function public.public_pet_identities(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Set active pack for the calling user (multi-pet)
-- ---------------------------------------------------------------------------

create or replace function public.set_active_pack(pet_ids uuid[])
returns setof public.dog_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure all ids belong to the caller (empty pack is allowed)
  if pet_ids is not null
     and cardinality(pet_ids) > 0
     and exists (
       select 1
       from unnest(pet_ids) as t(id)
       where not exists (
         select 1 from public.dog_profiles d
         where d.id = t.id and d.user_id = uid
       )
     )
  then
    raise exception 'One or more pets are not owned by the caller';
  end if;

  update public.dog_profiles
  set is_active = false, updated_at = now()
  where user_id = uid
    and is_active = true
    and (
      pet_ids is null
      or cardinality(pet_ids) = 0
      or id <> all (pet_ids)
    );

  if pet_ids is not null and cardinality(pet_ids) > 0 then
    update public.dog_profiles
    set is_active = true, updated_at = now()
    where user_id = uid
      and id = any (pet_ids)
      and is_active = false;
  end if;

  return query
    select *
    from public.dog_profiles
    where user_id = uid
    order by created_at asc;
end;
$$;

revoke all on function public.set_active_pack(uuid[]) from public;
grant execute on function public.set_active_pack(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- pet-photos storage bucket
-- Path convention: {user_id}/{pet_id}/{uuid}.{ext}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-photos',
  'pet-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pet_photos_storage_select on storage.objects;
create policy pet_photos_storage_select on storage.objects
  for select
  to authenticated, anon
  using (
    bucket_id = 'pet-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_moderator()
      or exists (
        select 1
        from public.dog_profiles dp
        where dp.photo_path = name
          and dp.public_display_enabled = true
      )
    )
  );

drop policy if exists pet_photos_storage_insert on storage.objects;
create policy pet_photos_storage_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pet-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists pet_photos_storage_update on storage.objects;
create policy pet_photos_storage_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'pet-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_moderator()
    )
  )
  with check (
    bucket_id = 'pet-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_moderator()
    )
  );

drop policy if exists pet_photos_storage_delete on storage.objects;
create policy pet_photos_storage_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pet-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_moderator()
    )
  );
