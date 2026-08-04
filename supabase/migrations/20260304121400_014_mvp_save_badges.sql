-- Migration 014 — simplified MVP save fields
-- dog_badges on saves; been_there status; expanded place categories.

-- Status: keep visited for back-compat; app UI uses been_there
do $$ begin
  alter type public.save_status add value if not exists 'been_there';
exception
  when duplicate_object then null;
end $$;

-- Categories for the simplified place set
do $$ begin
  alter type public.place_category add value if not exists 'attraction';
  alter type public.place_category add value if not exists 'landmark';
  alter type public.place_category add value if not exists 'shopping';
  alter type public.place_category add value if not exists 'transport';
  alter type public.place_category add value if not exists 'pet_service';
exception
  when duplicate_object then null;
end $$;

alter table public.user_place_saves
  add column if not exists dog_badges text[] not null default '{}';

comment on column public.user_place_saves.dog_badges is
  'Optional dog-access badges selected by the saver (not a policy engine).';

-- Public pin overlay: other users' public saves with place geometry
create or replace function public.list_public_saved_places(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_limit integer default 200
)
returns table (
  save_id uuid,
  place_id uuid,
  user_id uuid,
  handle text,
  display_name text,
  status public.save_status,
  dog_badges text[],
  place_name text,
  place_slug text,
  category public.place_category,
  lat double precision,
  lng double precision,
  city text,
  address_line1 text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 400));
begin
  return query
  select
    s.id as save_id,
    s.place_id,
    s.user_id,
    pr.handle,
    pr.display_name,
    s.status,
    s.dog_badges,
    p.name as place_name,
    p.slug as place_slug,
    p.category,
    p.lat,
    p.lng,
    p.city,
    p.address_line1
  from public.user_place_saves s
  join public.places p on p.id = s.place_id
  join public.profiles pr on pr.id = s.user_id
  where s.visibility = 'public'
    and p.status = 'active'
    and p.lat between p_min_lat and p_max_lat
    and p.lng between p_min_lng and p_max_lng
    and (auth.uid() is null or s.user_id is distinct from auth.uid())
  order by s.updated_at desc
  limit v_limit;
end;
$$;

revoke all on function public.list_public_saved_places(double precision, double precision, double precision, double precision, integer) from public;
grant execute on function public.list_public_saved_places(double precision, double precision, double precision, double precision, integer) to anon, authenticated;
