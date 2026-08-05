-- Migration 015 — discovery cache, API usage, map layer preferences

-- ---------------------------------------------------------------------------
-- place_provider_cache — server-side enrichment cache (no private user data)
-- ---------------------------------------------------------------------------

create table if not exists public.place_provider_cache (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  provider text not null,
  details_json jsonb not null default '{}'::jsonb,
  photo_refs_json jsonb not null default '[]'::jsonb,
  tips_json jsonb not null default '[]'::jsonb,
  attribution_json jsonb not null default '{}'::jsonb,
  pricing_tier text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (place_id, provider)
);

create index if not exists place_provider_cache_place_idx
  on public.place_provider_cache (place_id);

alter table public.place_provider_cache enable row level security;

-- Authenticated users may read cache for places they can see (canonical public info).
-- Writes are service-role / server only (no insert/update policies for clients).
drop policy if exists "place_provider_cache_select" on public.place_provider_cache;
create policy "place_provider_cache_select"
  on public.place_provider_cache
  for select
  to authenticated
  using (true);

grant select on public.place_provider_cache to authenticated;

-- ---------------------------------------------------------------------------
-- external_api_usage — operational guardrail counters
-- ---------------------------------------------------------------------------

create table if not exists public.external_api_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  endpoint text not null,
  pricing_tier text,
  request_count integer not null default 0,
  estimated_cost_usd numeric(12, 4) not null default 0,
  billing_month text not null,
  last_requested_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, endpoint, billing_month)
);

alter table public.external_api_usage enable row level security;
-- No client policies — service role only

-- ---------------------------------------------------------------------------
-- user_map_preferences — remember My places / Community layer toggles
-- ---------------------------------------------------------------------------

create table if not exists public.user_map_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  show_my_places boolean not null default true,
  show_community boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_map_preferences enable row level security;

drop policy if exists "user_map_preferences_select_own" on public.user_map_preferences;
create policy "user_map_preferences_select_own"
  on public.user_map_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_map_preferences_upsert_own" on public.user_map_preferences;
create policy "user_map_preferences_insert_own"
  on public.user_map_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_map_preferences_update_own" on public.user_map_preferences;
create policy "user_map_preferences_update_own"
  on public.user_map_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.user_map_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Public contributor counts for a set of place ids (batch decorate)
-- ---------------------------------------------------------------------------

create or replace function public.count_public_saves_for_places(place_ids uuid[])
returns table (place_id uuid, contributor_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.place_id, count(*)::bigint as contributor_count
  from public.user_place_saves s
  where s.place_id = any(place_ids)
    and s.visibility = 'public'
  group by s.place_id;
$$;

revoke all on function public.count_public_saves_for_places(uuid[]) from public;
grant execute on function public.count_public_saves_for_places(uuid[]) to authenticated;
