-- Migration 008 — affiliate click reporting
-- Phase 8: log disclosed booking CTA clicks for partner reporting.
-- Confidence scoring must ignore affiliate data (enforced in app).

-- ---------------------------------------------------------------------------
-- affiliate_click_events
-- ---------------------------------------------------------------------------

create table if not exists public.affiliate_click_events (
  id uuid primary key default gen_random_uuid(),
  affiliate_link_id uuid not null references public.affiliate_links (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  network text,
  viewer_id uuid references auth.users (id) on delete set null,
  referrer text,
  user_agent text,
  clicked_at timestamptz not null default now()
);

create index if not exists affiliate_click_events_clicked_idx
  on public.affiliate_click_events (clicked_at desc);

create index if not exists affiliate_click_events_place_day_idx
  on public.affiliate_click_events (place_id, clicked_at desc);

create index if not exists affiliate_click_events_network_day_idx
  on public.affiliate_click_events (network, clicked_at desc);

create index if not exists affiliate_click_events_link_idx
  on public.affiliate_click_events (affiliate_link_id);

alter table public.affiliate_click_events enable row level security;

-- Moderators/admins can read rollups; clients never select raw click rows.
drop policy if exists affiliate_click_events_select on public.affiliate_click_events;
create policy affiliate_click_events_select on public.affiliate_click_events
  for select
  using (public.is_moderator());

-- No direct client inserts — use record_affiliate_click RPC.

-- ---------------------------------------------------------------------------
-- record_affiliate_click: hop logger (returns destination URL or null)
-- ---------------------------------------------------------------------------

create or replace function public.record_affiliate_click(
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
  v_network text;
  v_active boolean;
begin
  select al.url, al.place_id, al.network, al.is_active
    into v_url, v_place_id, v_network, v_active
  from public.affiliate_links al
  where al.id = p_link_id;

  if not found or coalesce(v_active, false) = false or v_url is null or length(trim(v_url)) = 0 then
    return null;
  end if;

  insert into public.affiliate_click_events (
    affiliate_link_id,
    place_id,
    network,
    viewer_id,
    referrer,
    user_agent
  ) values (
    p_link_id,
    v_place_id,
    v_network,
    auth.uid(),
    left(nullif(trim(coalesce(p_referrer, '')), ''), 500),
    left(nullif(trim(coalesce(p_user_agent, '')), ''), 500)
  );

  return v_url;
end;
$$;

revoke all on function public.record_affiliate_click(uuid, text, text) from public;
grant execute on function public.record_affiliate_click(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- partner_click_report: daily rollup for moderators
-- ---------------------------------------------------------------------------

create or replace function public.partner_click_report(
  p_days integer default 30
)
returns table (
  day date,
  network text,
  place_id uuid,
  place_name text,
  place_slug text,
  clicks bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  return query
  select
    (e.clicked_at at time zone 'utc')::date as day,
    e.network,
    e.place_id,
    p.name as place_name,
    p.slug as place_slug,
    count(*)::bigint as clicks
  from public.affiliate_click_events e
  join public.places p on p.id = e.place_id
  where e.clicked_at >= (now() - make_interval(days => v_days))
  group by 1, 2, 3, 4, 5
  order by 1 desc, clicks desc;
end;
$$;

revoke all on function public.partner_click_report(integer) from public;
grant execute on function public.partner_click_report(integer) to authenticated;
