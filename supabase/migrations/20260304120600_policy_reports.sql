-- Phase 4: user reports of incorrect policy / closed places.

create table if not exists public.policy_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null default 'incorrect_policy',
  note text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists policy_reports_place_idx on public.policy_reports (place_id);
create index if not exists policy_reports_status_idx on public.policy_reports (status);

alter table public.policy_reports enable row level security;

drop policy if exists policy_reports_insert_own on public.policy_reports;
create policy policy_reports_insert_own
  on public.policy_reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists policy_reports_select_own_or_moderator on public.policy_reports;
create policy policy_reports_select_own_or_moderator
  on public.policy_reports
  for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());

drop policy if exists policy_reports_update_moderator on public.policy_reports;
create policy policy_reports_update_moderator
  on public.policy_reports
  for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());
