-- Migration 003 — collections, follows, affiliates
-- Phase 8 (+3/6): collections, follows, affiliate_links + RLS
-- Affiliates: public read of active links; writes admin only.
-- Confidence scoring must ignore affiliate data (enforced in app + docs).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.collection_visibility as enum ('private', 'link', 'public');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.follow_target_type as enum ('user', 'collection');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- collections
-- ---------------------------------------------------------------------------

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  visibility public.collection_visibility not null default 'private',
  cover_place_id uuid references public.places (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index if not exists collections_owner_idx on public.collections (owner_id);
create index if not exists collections_visibility_idx on public.collections (visibility);

create table if not exists public.collection_places (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  note text,
  sort_order integer not null default 0,
  added_at timestamptz not null default now(),
  unique (collection_id, place_id)
);

create index if not exists collection_places_collection_idx
  on public.collection_places (collection_id);

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.follow_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (follower_id, target_type, target_id)
);

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_target_idx on public.follows (target_type, target_id);

-- ---------------------------------------------------------------------------
-- affiliate_links
-- ---------------------------------------------------------------------------

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  label text not null default 'Check availability',
  url text not null,
  network text,
  disclosed boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_links_place_idx on public.affiliate_links (place_id);
create index if not exists affiliate_links_active_idx
  on public.affiliate_links (place_id) where is_active;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

drop trigger if exists affiliate_links_set_updated_at on public.affiliate_links;
create trigger affiliate_links_set_updated_at
  before update on public.affiliate_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.collections enable row level security;
alter table public.collection_places enable row level security;
alter table public.follows enable row level security;
alter table public.affiliate_links enable row level security;

-- collections: owner full access; public/link readable by anyone
drop policy if exists collections_select on public.collections;
create policy collections_select on public.collections
  for select
  using (
    visibility in ('public', 'link')
    or owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

drop policy if exists collections_insert on public.collections;
create policy collections_insert on public.collections
  for insert
  with check (owner_id = auth.uid());

drop policy if exists collections_update on public.collections;
create policy collections_update on public.collections
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists collections_delete on public.collections;
create policy collections_delete on public.collections
  for delete
  using (owner_id = auth.uid());

-- collection_places follow parent visibility
drop policy if exists collection_places_select on public.collection_places;
create policy collection_places_select on public.collection_places
  for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (
          c.visibility in ('public', 'link')
          or c.owner_id = auth.uid()
        )
    )
  );

drop policy if exists collection_places_mutate on public.collection_places;
create policy collection_places_mutate on public.collection_places
  for all
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
  );

-- follows: follower manages own rows; target can see follower list optionally via select
drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows
  for select
  using (
    follower_id = auth.uid()
    or (
      target_type = 'user' and target_id = auth.uid()
    )
  );

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows
  for insert
  with check (follower_id = auth.uid());

drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows
  for delete
  using (follower_id = auth.uid());

-- affiliate_links: public read active; write admin only
drop policy if exists affiliate_links_select on public.affiliate_links;
create policy affiliate_links_select on public.affiliate_links
  for select
  using (
    is_active = true
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'moderator')
    )
  );

drop policy if exists affiliate_links_insert on public.affiliate_links;
create policy affiliate_links_insert on public.affiliate_links
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists affiliate_links_update on public.affiliate_links;
create policy affiliate_links_update on public.affiliate_links
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists affiliate_links_delete on public.affiliate_links;
create policy affiliate_links_delete on public.affiliate_links
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
