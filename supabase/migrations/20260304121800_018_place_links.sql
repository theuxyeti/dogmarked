-- Migration 018 — provider-neutral place_links
-- Phase 11: official / booking / foursquare / other links with is_affiliate default false.
-- Keeps affiliate_links for the future monetized path (BOOKING_AFFILIATE_ENABLED).

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.place_link_provider as enum (
    'official',
    'booking',
    'foursquare',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- place_links
-- ---------------------------------------------------------------------------

create table if not exists public.place_links (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  provider public.place_link_provider not null,
  url text not null,
  label text not null,
  external_property_id text,
  is_affiliate boolean not null default false,
  is_verified boolean not null default false,
  match_confidence numeric(4, 3)
    check (
      match_confidence is null
      or (match_confidence >= 0 and match_confidence <= 1)
    ),
  verified_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_links_url_nonempty check (length(trim(url)) > 0),
  constraint place_links_label_nonempty check (length(trim(label)) > 0)
);

create index if not exists place_links_place_idx
  on public.place_links (place_id);

create index if not exists place_links_place_public_idx
  on public.place_links (place_id, provider)
  where is_active and is_verified;

create unique index if not exists place_links_place_provider_url_uidx
  on public.place_links (place_id, provider, url);

drop trigger if exists place_links_set_updated_at on public.place_links;
create trigger place_links_set_updated_at
  before update on public.place_links
  for each row execute function public.set_updated_at();

alter table public.place_links enable row level security;

-- Public read verified + active; creators and moderators see their own / all.
drop policy if exists place_links_select on public.place_links;
create policy place_links_select
  on public.place_links
  for select
  to anon, authenticated
  using (
    (is_active = true and is_verified = true)
    or created_by = auth.uid()
    or public.is_moderator()
  );

-- Authenticated contributors may add non-affiliate official/booking links.
-- Affiliate rows stay admin/service-mediated (future BOOKING_AFFILIATE_ENABLED).
drop policy if exists place_links_insert on public.place_links;
create policy place_links_insert
  on public.place_links
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and is_affiliate = false
    and provider in ('official', 'booking')
    and (
      public.is_moderator()
      or exists (
        select 1
        from public.places p
        where p.id = place_links.place_id
          and p.created_by = auth.uid()
      )
      or exists (
        select 1
        from public.policy_contributions c
        where c.place_id = place_links.place_id
          and c.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.user_place_saves s
        where s.place_id = place_links.place_id
          and s.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.pet_policy_reports r
        where r.place_id = place_links.place_id
          and r.user_id = auth.uid()
      )
    )
  );

drop policy if exists place_links_update on public.place_links;
create policy place_links_update
  on public.place_links
  for update
  to authenticated
  using (created_by = auth.uid() or public.is_moderator())
  with check (
    (created_by = auth.uid() or public.is_moderator())
    and (
      is_affiliate = false
      or public.is_moderator()
    )
  );

drop policy if exists place_links_delete on public.place_links;
create policy place_links_delete
  on public.place_links
  for delete
  to authenticated
  using (created_by = auth.uid() or public.is_moderator());

-- ---------------------------------------------------------------------------
-- place_link_click_events (works for affiliate and non-affiliate links)
-- ---------------------------------------------------------------------------

create table if not exists public.place_link_click_events (
  id uuid primary key default gen_random_uuid(),
  place_link_id uuid not null references public.place_links (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  provider public.place_link_provider not null,
  is_affiliate boolean not null default false,
  viewer_id uuid references auth.users (id) on delete set null,
  referrer text,
  user_agent text,
  clicked_at timestamptz not null default now()
);

create index if not exists place_link_click_events_clicked_idx
  on public.place_link_click_events (clicked_at desc);

create index if not exists place_link_click_events_place_idx
  on public.place_link_click_events (place_id, clicked_at desc);

create index if not exists place_link_click_events_link_idx
  on public.place_link_click_events (place_link_id);

alter table public.place_link_click_events enable row level security;

drop policy if exists place_link_click_events_select on public.place_link_click_events;
create policy place_link_click_events_select
  on public.place_link_click_events
  for select
  using (public.is_moderator());

-- No direct client inserts — use record_place_link_click RPC.

-- ---------------------------------------------------------------------------
-- record_place_link_click: hop logger (returns destination URL or null)
-- Does not require is_affiliate — logs verified active links of any provider.
-- ---------------------------------------------------------------------------

create or replace function public.record_place_link_click(
  p_link_id uuid,
  p_referrer text default null,
  p_user_agent text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_place_id uuid;
  v_provider public.place_link_provider;
  v_is_affiliate boolean;
  v_active boolean;
  v_verified boolean;
begin
  select pl.url, pl.place_id, pl.provider, pl.is_affiliate, pl.is_active, pl.is_verified
    into v_url, v_place_id, v_provider, v_is_affiliate, v_active, v_verified
  from public.place_links pl
  where pl.id = p_link_id;

  if not found
     or coalesce(v_active, false) = false
     or coalesce(v_verified, false) = false
     or v_url is null
     or length(trim(v_url)) = 0 then
    return null;
  end if;

  insert into public.place_link_click_events (
    place_link_id,
    place_id,
    provider,
    is_affiliate,
    viewer_id,
    referrer,
    user_agent
  ) values (
    p_link_id,
    v_place_id,
    v_provider,
    coalesce(v_is_affiliate, false),
    auth.uid(),
    left(coalesce(p_referrer, ''), 2000),
    left(coalesce(p_user_agent, ''), 1000)
  );

  return v_url;
end;
$$;

revoke all on function public.record_place_link_click(uuid, text, text) from public;
grant execute on function public.record_place_link_click(uuid, text, text) to anon, authenticated;
