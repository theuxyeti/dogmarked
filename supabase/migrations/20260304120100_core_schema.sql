-- Phase 1 core schema: places, saves, dog policies, contributions, evidence, audit

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.place_category as enum (
  'park',
  'restaurant',
  'beach',
  'hotel',
  'cafe',
  'other'
);

create type public.place_status as enum (
  'active',
  'closed',
  'duplicate_merged'
);

create type public.place_source_type as enum (
  'curated',
  'user',
  'import',
  'partner'
);

create type public.save_status as enum (
  'want_to_go',
  'visited',
  'recommended'
);

create type public.save_visibility as enum (
  'private',
  'link',
  'public'
);

create type public.dog_status as enum (
  'dogs_welcome',
  'dogs_ok_outdoors',
  'dogs_ok_with_restrictions',
  'ask_first',
  'service_animals_only',
  'no_dogs'
);

create type public.fee_type as enum (
  'none',
  'flat',
  'per_dog',
  'per_night',
  'deposit',
  'unknown'
);

create type public.moderation_status as enum (
  'draft',
  'in_review',
  'published',
  'rejected'
);

create type public.contribution_source_type as enum (
  'firsthand',
  'official_website',
  'staff',
  'signage',
  'other'
);

create type public.dog_size_class as enum (
  'toy',
  'small',
  'medium',
  'large',
  'giant',
  'unknown'
);

create type public.photo_source_type as enum (
  'user_upload',
  'placeholder',
  'partner',
  'import',
  'unknown'
);

create type public.storage_permission as enum (
  'allowed_permanent',
  'link_only',
  'unknown'
);

create type public.evidence_kind as enum (
  'photo',
  'url',
  'note',
  'other'
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  display_name text,
  role text not null default 'user'
    check (role in ('user', 'contributor', 'moderator', 'admin')),
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_handle_idx on public.profiles (handle);

-- ---------------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------------

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category public.place_category not null default 'other',
  location geography(Point, 4326) not null,
  lat double precision not null,
  lng double precision not null,
  country_code char(2) not null default 'US',
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  address jsonb not null default '{}'::jsonb,
  website text,
  phone text,
  status public.place_status not null default 'active',
  duplicate_of_place_id uuid references public.places (id) on delete set null,
  source_type public.place_source_type not null default 'curated',
  source_attribution text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (duplicate_of_place_id is distinct from id)
);

create index places_location_gix on public.places using gist (location);
create index places_status_idx on public.places (status);
create index places_category_idx on public.places (category);
create index places_city_idx on public.places (city);

-- ---------------------------------------------------------------------------
-- user_place_saves
-- ---------------------------------------------------------------------------

create table public.user_place_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  status public.save_status not null default 'want_to_go',
  visibility public.save_visibility not null default 'private',
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create index user_place_saves_user_idx on public.user_place_saves (user_id);
create index user_place_saves_place_idx on public.user_place_saves (place_id);

-- ---------------------------------------------------------------------------
-- Shared dog-policy column pattern (contributions / canonical / versions)
-- ---------------------------------------------------------------------------

create table public.policy_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  dog_status public.dog_status not null,
  access text[] not null default '{}',
  max_dogs integer check (max_dogs is null or max_dogs > 0),
  max_weight_kg numeric(6, 2) check (max_weight_kg is null or max_weight_kg > 0),
  max_combined_weight_kg numeric(6, 2) check (max_combined_weight_kg is null or max_combined_weight_kg > 0),
  small_dogs_only boolean not null default false,
  carrier_required boolean not null default false,
  leash_required boolean not null default true,
  advance_approval_required boolean not null default false,
  fee_type public.fee_type not null default 'none',
  fee_amount numeric(10, 2),
  fee_currency char(3) default 'USD',
  exception_text text,
  source_type public.contribution_source_type not null default 'firsthand',
  source_url text,
  observed_at date,
  moderation_status public.moderation_status not null default 'draft',
  moderator_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index policy_contributions_place_idx on public.policy_contributions (place_id);
create index policy_contributions_user_idx on public.policy_contributions (user_id);
create index policy_contributions_moderation_idx on public.policy_contributions (moderation_status);

create table public.dog_policies (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references public.places (id) on delete cascade,
  dog_status public.dog_status not null,
  access text[] not null default '{}',
  max_dogs integer check (max_dogs is null or max_dogs > 0),
  max_weight_kg numeric(6, 2) check (max_weight_kg is null or max_weight_kg > 0),
  max_combined_weight_kg numeric(6, 2) check (max_combined_weight_kg is null or max_combined_weight_kg > 0),
  small_dogs_only boolean not null default false,
  carrier_required boolean not null default false,
  leash_required boolean not null default true,
  advance_approval_required boolean not null default false,
  fee_type public.fee_type not null default 'none',
  fee_amount numeric(10, 2),
  fee_currency char(3) default 'USD',
  exception_text text,
  confidence numeric(3, 2) not null default 0.50
    check (confidence >= 0 and confidence <= 1),
  last_verified_at timestamptz,
  promoted_from_contribution_id uuid references public.policy_contributions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dog_policies_status_idx on public.dog_policies (dog_status);

create table public.dog_policy_versions (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  dog_policy_id uuid references public.dog_policies (id) on delete set null,
  dog_status public.dog_status not null,
  access text[] not null default '{}',
  max_dogs integer,
  max_weight_kg numeric(6, 2),
  max_combined_weight_kg numeric(6, 2),
  small_dogs_only boolean not null default false,
  carrier_required boolean not null default false,
  leash_required boolean not null default true,
  advance_approval_required boolean not null default false,
  fee_type public.fee_type not null default 'none',
  fee_amount numeric(10, 2),
  fee_currency char(3) default 'USD',
  exception_text text,
  confidence numeric(3, 2),
  last_verified_at timestamptz,
  promoted_from_contribution_id uuid references public.policy_contributions (id) on delete set null,
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index dog_policy_versions_place_idx on public.dog_policy_versions (place_id, snapshot_at desc);

-- ---------------------------------------------------------------------------
-- dog_profiles
-- ---------------------------------------------------------------------------

create table public.dog_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg > 0),
  size_class public.dog_size_class not null default 'unknown',
  travels_in_carrier boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dog_profiles_user_idx on public.dog_profiles (user_id);

-- ---------------------------------------------------------------------------
-- place_photos (licensing-aware)
-- ---------------------------------------------------------------------------

create table public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  source_type public.photo_source_type not null default 'unknown',
  source_url text,
  attribution_text text,
  license text,
  storage_permission public.storage_permission not null default 'unknown',
  storage_path text,
  caption text,
  is_primary boolean not null default false,
  is_evidence boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index place_photos_place_idx on public.place_photos (place_id);
create index place_photos_primary_idx on public.place_photos (place_id) where is_primary;

-- ---------------------------------------------------------------------------
-- policy_evidence
-- ---------------------------------------------------------------------------

create table public.policy_evidence (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid references public.policy_contributions (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  photo_id uuid references public.place_photos (id) on delete set null,
  kind public.evidence_kind not null default 'note',
  url text,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index policy_evidence_contribution_idx on public.policy_evidence (contribution_id);
create index policy_evidence_place_idx on public.policy_evidence (place_id);

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index audit_events_actor_idx on public.audit_events (actor_id);
create index audit_events_created_idx on public.audit_events (created_at desc);

-- ---------------------------------------------------------------------------
-- import_sources (stub for Phase 2+ ingestion)
-- ---------------------------------------------------------------------------

create table public.import_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  base_url text,
  license_notes text,
  is_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

create trigger user_place_saves_set_updated_at
  before update on public.user_place_saves
  for each row execute function public.set_updated_at();

create trigger policy_contributions_set_updated_at
  before update on public.policy_contributions
  for each row execute function public.set_updated_at();

create trigger dog_policies_set_updated_at
  before update on public.dog_policies
  for each row execute function public.set_updated_at();

create trigger dog_profiles_set_updated_at
  before update on public.dog_profiles
  for each row execute function public.set_updated_at();

create trigger place_photos_set_updated_at
  before update on public.place_photos
  for each row execute function public.set_updated_at();

create trigger import_sources_set_updated_at
  before update on public.import_sources
  for each row execute function public.set_updated_at();
