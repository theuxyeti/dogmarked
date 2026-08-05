-- Migration 017 — structured pet policy reports + official evidence fields
-- Phase 8: pet_policy_reports (trip/policy reports) and additive policy_evidence columns.
-- Keeps legacy policy_reports (incorrect-policy flags), dog_badges, and dog_policies.
-- pet_ids references dog_profiles.id values (uuid[]); no array FK in Postgres.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.pet_policy_overall_status as enum (
    'confirmed',
    'restricted',
    'ask_first',
    'unknown',
    'not_allowed'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.pet_policy_report_visibility as enum (
    'private',
    'public'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.pet_policy_evidence_type as enum (
    'firsthand_visit',
    'official_policy',
    'direct_confirmation',
    'provider_listing',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- pet_policy_reports
-- ---------------------------------------------------------------------------

create table if not exists public.pet_policy_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pet_ids uuid[] not null default '{}',
  visited_on date,
  visibility public.pet_policy_report_visibility not null default 'private',
  overall_status public.pet_policy_overall_status not null default 'unknown',
  allowed_sizes text[] not null default '{}',
  weight_limit_lb numeric(6, 2)
    check (weight_limit_lb is null or weight_limit_lb > 0),
  max_dogs integer
    check (max_dogs is null or max_dogs > 0),
  areas jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  fee jsonb,
  note text,
  evidence_type public.pet_policy_evidence_type not null default 'firsthand_visit',
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_policy_reports_allowed_sizes_check
    check (
      allowed_sizes <@ array['small', 'medium', 'large']::text[]
    )
);

create index if not exists pet_policy_reports_place_idx
  on public.pet_policy_reports (place_id);

create index if not exists pet_policy_reports_user_idx
  on public.pet_policy_reports (user_id);

create index if not exists pet_policy_reports_place_public_idx
  on public.pet_policy_reports (place_id, visited_on desc nulls last)
  where visibility = 'public';

drop trigger if exists pet_policy_reports_set_updated_at on public.pet_policy_reports;
create trigger pet_policy_reports_set_updated_at
  before update on public.pet_policy_reports
  for each row execute function public.set_updated_at();

alter table public.pet_policy_reports enable row level security;

drop policy if exists pet_policy_reports_select on public.pet_policy_reports;
create policy pet_policy_reports_select
  on public.pet_policy_reports
  for select
  to anon, authenticated
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or public.is_moderator()
  );

drop policy if exists pet_policy_reports_insert_own on public.pet_policy_reports;
create policy pet_policy_reports_insert_own
  on public.pet_policy_reports
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists pet_policy_reports_update_own on public.pet_policy_reports;
create policy pet_policy_reports_update_own
  on public.pet_policy_reports
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_moderator())
  with check (user_id = auth.uid() or public.is_moderator());

drop policy if exists pet_policy_reports_delete_own on public.pet_policy_reports;
create policy pet_policy_reports_delete_own
  on public.pet_policy_reports
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_moderator());

comment on table public.pet_policy_reports is
  'Structured firsthand/official dog-policy trip reports. Distinct from policy_reports (incorrect-policy flags).';

-- ---------------------------------------------------------------------------
-- policy_evidence — additive columns for official sources / excerpts
-- (table already exists from core schema; do not replace contribution-linked rows)
-- ---------------------------------------------------------------------------

alter table public.policy_evidence
  add column if not exists report_id uuid references public.pet_policy_reports (id) on delete set null;

alter table public.policy_evidence
  add column if not exists excerpt text;

alter table public.policy_evidence
  add column if not exists retrieved_at timestamptz;

alter table public.policy_evidence
  add column if not exists source_title text;

alter table public.policy_evidence
  add column if not exists is_official boolean not null default false;

create index if not exists policy_evidence_report_idx
  on public.policy_evidence (report_id)
  where report_id is not null;

create index if not exists policy_evidence_official_place_idx
  on public.policy_evidence (place_id)
  where is_official = true;

comment on column public.policy_evidence.excerpt is
  'Short excerpt from an official or submitted source page.';
comment on column public.policy_evidence.retrieved_at is
  'When the excerpt/URL was last retrieved or verified.';

-- Refresh select policy so public official / public-report evidence is readable
drop policy if exists "policy_evidence_select" on public.policy_evidence;
create policy "policy_evidence_select"
  on public.policy_evidence
  for select
  to anon, authenticated
  using (
    created_by = auth.uid()
    or public.is_moderator()
    or (
      contribution_id is not null
      and exists (
        select 1
        from public.policy_contributions c
        where c.id = contribution_id
          and (
            c.moderation_status = 'published'
            or c.user_id = auth.uid()
            or public.is_moderator()
          )
      )
    )
    or (
      is_official = true
      and (
        report_id is null
        or exists (
          select 1
          from public.pet_policy_reports r
          where r.id = report_id
            and (r.visibility = 'public' or r.user_id = auth.uid())
        )
      )
    )
    or exists (
      select 1
      from public.pet_policy_reports r
      where r.id = report_id
        and (r.visibility = 'public' or r.user_id = auth.uid())
    )
  );

drop policy if exists "policy_evidence_insert_own" on public.policy_evidence;
create policy "policy_evidence_insert_own"
  on public.policy_evidence
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "policy_evidence_update_own" on public.policy_evidence;
create policy "policy_evidence_update_own"
  on public.policy_evidence
  for update
  to authenticated
  using (created_by = auth.uid() or public.is_moderator())
  with check (created_by = auth.uid() or public.is_moderator());

drop policy if exists "policy_evidence_delete_own" on public.policy_evidence;
create policy "policy_evidence_delete_own"
  on public.policy_evidence
  for delete
  to authenticated
  using (created_by = auth.uid() or public.is_moderator());
