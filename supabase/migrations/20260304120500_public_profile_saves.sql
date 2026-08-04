-- Migration 005 — public profile saves RPCs
-- Phase 3: expose public saves for profiles without leaking private_notes.
-- Clients must use this RPC (or owner RLS) — no broad anon select on user_place_saves.

create or replace function public.list_public_saves_for_handle(p_handle text)
returns table (
  place_id uuid,
  status public.save_status,
  place_name text,
  place_slug text,
  city text,
  category public.place_category
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.place_id,
    s.status,
    p.name,
    p.slug,
    p.city,
    p.category
  from public.profiles pr
  join public.user_place_saves s on s.user_id = pr.id
  join public.places p on p.id = s.place_id
  where lower(pr.handle) = lower(p_handle)
    and s.visibility = 'public'
    and p.status = 'active'
  order by s.updated_at desc;
$$;

revoke all on function public.list_public_saves_for_handle(text) from public;
grant execute on function public.list_public_saves_for_handle(text) to anon, authenticated;

create or replace function public.get_profile_by_handle(p_handle text)
returns table (
  id uuid,
  handle text,
  display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.handle, pr.display_name
  from public.profiles pr
  where lower(pr.handle) = lower(p_handle)
  limit 1;
$$;

revoke all on function public.get_profile_by_handle(text) from public;
grant execute on function public.get_profile_by_handle(text) to anon, authenticated;
