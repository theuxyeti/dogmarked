-- Migration 010 — place photos storage bucket
-- Phase 4/7: permanent binary storage for user-owned evidence with licensing.
-- Never assume MapTiler/OSM/partner images are storable without rights.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'place-photos',
  'place-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {user_id}/{place_id}/{uuid}.{ext}

drop policy if exists place_photos_storage_select on storage.objects;
create policy place_photos_storage_select on storage.objects
  for select
  to authenticated, anon
  using (
    bucket_id = 'place-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_moderator()
      or exists (
        select 1
        from public.place_photos ph
        where ph.storage_path = name
          and ph.storage_permission = 'allowed_permanent'
      )
    )
  );

drop policy if exists place_photos_storage_insert on storage.objects;
create policy place_photos_storage_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'place-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists place_photos_storage_update on storage.objects;
create policy place_photos_storage_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'place-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_moderator()
    )
  )
  with check (
    bucket_id = 'place-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_moderator()
    )
  );

drop policy if exists place_photos_storage_delete on storage.objects;
create policy place_photos_storage_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'place-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_moderator()
    )
  );
