-- Migration 012 — profile ensure, contribution RLS harden, external_place_refs
-- Fixes missing auth→profiles trigger (FK failures misreported as RLS),
-- hardens policy_contributions own-draft rules, adds external place refs.

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup (was documented but missing)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  candidate text;
  suffix int := 0;
begin
  base_handle := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data->>'handle', ''),
      split_part(coalesce(new.email, 'user'), '@', 1),
      'user'
    ),
    '[^a-z0-9_]+',
    '',
    'g'
  ));
  if base_handle is null or length(base_handle) < 2 then
    base_handle := 'user';
  end if;
  base_handle := left(base_handle, 24);
  candidate := base_handle;

  while exists (select 1 from public.profiles p where p.handle = candidate) loop
    suffix := suffix + 1;
    candidate := left(base_handle, 20) || suffix::text;
  end loop;

  insert into public.profiles (id, handle, display_name, role)
  values (
    new.id,
    candidate,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), candidate),
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for existing auth users missing a row
insert into public.profiles (id, handle, display_name, role)
select
  u.id,
  left('user' || replace(u.id::text, '-', ''), 24),
  coalesce(split_part(u.email, '@', 1), 'user'),
  'user'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Ensure profile helper (callable from API when trigger missed)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_own_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.profiles%rowtype;
  candidate text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into row from public.profiles where id = uid;
  if found then
    return row;
  end if;

  candidate := left('user' || replace(uid::text, '-', ''), 24);
  insert into public.profiles (id, handle, display_name, role)
  values (uid, candidate, candidate, 'user')
  on conflict (id) do nothing;

  select * into row from public.profiles where id = uid;
  return row;
end;
$$;

revoke all on function public.ensure_own_profile() from public;
grant execute on function public.ensure_own_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Harden policy_contributions RLS
-- Clients: create/edit own drafts (and in_review). Cannot set published/rejected.
-- Moderators: update any. Promote remains SECURITY DEFINER RPC only.
-- ---------------------------------------------------------------------------

drop policy if exists "policy_contributions_insert_own_draft" on public.policy_contributions;
drop policy if exists "policy_contributions_update_own_drafts" on public.policy_contributions;

create policy "policy_contributions_insert_own_draft"
  on public.policy_contributions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and moderation_status in ('draft', 'in_review')
  );

create policy "policy_contributions_update_own_drafts"
  on public.policy_contributions
  for update
  to authenticated
  using (
    (user_id = auth.uid() and moderation_status in ('draft', 'in_review'))
    or public.is_moderator()
  )
  with check (
    (
      user_id = auth.uid()
      and moderation_status in ('draft', 'in_review')
    )
    or public.is_moderator()
  );

-- Explicit table grants (safe if already granted)
grant select on public.policy_contributions to anon, authenticated;
grant insert, update on public.policy_contributions to authenticated;

-- ---------------------------------------------------------------------------
-- external_place_refs — third-party ids are NOT place PKs
-- Store only licensable / attribution fields; link optionally to places.
-- ---------------------------------------------------------------------------

create table if not exists public.external_place_refs (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places (id) on delete set null,
  provider text not null,
  external_id text not null,
  name text,
  category text,
  lat double precision,
  lng double precision,
  country_code char(2),
  formatted_address text,
  attribution text,
  raw_normalized jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create index if not exists external_place_refs_place_idx
  on public.external_place_refs (place_id);
create index if not exists external_place_refs_geo_idx
  on public.external_place_refs (lat, lng);

alter table public.external_place_refs enable row level security;

drop policy if exists "external_place_refs_select" on public.external_place_refs;
create policy "external_place_refs_select"
  on public.external_place_refs
  for select
  to anon, authenticated
  using (true);

-- No client writes — server / service role only
grant select on public.external_place_refs to anon, authenticated;

drop trigger if exists external_place_refs_set_updated_at on public.external_place_refs;
create trigger external_place_refs_set_updated_at
  before update on public.external_place_refs
  for each row execute function public.set_updated_at();
