-- Migration 002 — RLS + promote RPC
-- Phase 1 RLS policies + moderator helper + promote_policy_contribution RPC

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('moderator', 'admin')
  );
$$;

revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.user_place_saves enable row level security;
alter table public.policy_contributions enable row level security;
alter table public.dog_policies enable row level security;
alter table public.dog_policy_versions enable row level security;
alter table public.dog_profiles enable row level security;
alter table public.place_photos enable row level security;
alter table public.policy_evidence enable row level security;
alter table public.audit_events enable row level security;
alter table public.import_sources enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: public read; update own
-- ---------------------------------------------------------------------------

create policy "profiles_select_public"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- places: public read active; authenticated insert
-- ---------------------------------------------------------------------------

create policy "places_select_active"
  on public.places
  for select
  to anon, authenticated
  using (
    status = 'active'
    or created_by = auth.uid()
    or public.is_moderator()
  );

create policy "places_insert_authenticated"
  on public.places
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "places_update_own_or_moderator"
  on public.places
  for update
  to authenticated
  using (created_by = auth.uid() or public.is_moderator())
  with check (created_by = auth.uid() or public.is_moderator());

-- ---------------------------------------------------------------------------
-- user_place_saves: owner CRUD only (private_notes never exposed via public policies)
-- ---------------------------------------------------------------------------

create policy "user_place_saves_select_own"
  on public.user_place_saves
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_place_saves_insert_own"
  on public.user_place_saves
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_place_saves_update_own"
  on public.user_place_saves
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_place_saves_delete_own"
  on public.user_place_saves
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- policy_contributions
-- ---------------------------------------------------------------------------

create policy "policy_contributions_select_published_or_own"
  on public.policy_contributions
  for select
  to anon, authenticated
  using (
    moderation_status = 'published'
    or user_id = auth.uid()
    or public.is_moderator()
  );

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
    (user_id = auth.uid() and moderation_status in ('draft', 'in_review', 'published'))
    or public.is_moderator()
  );

-- ---------------------------------------------------------------------------
-- dog_policies / dog_policy_versions: SELECT only for clients
-- (writes only via service role or SECURITY DEFINER promote RPC)
-- ---------------------------------------------------------------------------

create policy "dog_policies_select_all"
  on public.dog_policies
  for select
  to anon, authenticated
  using (true);

create policy "dog_policy_versions_select_all"
  on public.dog_policy_versions
  for select
  to anon, authenticated
  using (true);

-- Intentionally no INSERT/UPDATE/DELETE policies for authenticated/anon.

-- ---------------------------------------------------------------------------
-- audit_events: no client access
-- ---------------------------------------------------------------------------

-- RLS enabled with zero policies for anon/authenticated → deny all client access.
-- Service role bypasses RLS.

-- ---------------------------------------------------------------------------
-- dog_profiles: owner CRUD
-- ---------------------------------------------------------------------------

create policy "dog_profiles_select_own"
  on public.dog_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "dog_profiles_insert_own"
  on public.dog_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "dog_profiles_update_own"
  on public.dog_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "dog_profiles_delete_own"
  on public.dog_profiles
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- place_photos: public read where storage ok; authenticated insert own
-- ---------------------------------------------------------------------------

create policy "place_photos_select_storage_ok"
  on public.place_photos
  for select
  to anon, authenticated
  using (
    storage_permission in ('allowed_permanent', 'link_only')
    or uploaded_by = auth.uid()
    or public.is_moderator()
  );

create policy "place_photos_insert_own"
  on public.place_photos
  for insert
  to authenticated
  with check (uploaded_by = auth.uid());

create policy "place_photos_update_own_or_moderator"
  on public.place_photos
  for update
  to authenticated
  using (uploaded_by = auth.uid() or public.is_moderator())
  with check (uploaded_by = auth.uid() or public.is_moderator());

-- ---------------------------------------------------------------------------
-- policy_evidence: published/own contribution or moderator
-- ---------------------------------------------------------------------------

create policy "policy_evidence_select"
  on public.policy_evidence
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.policy_contributions c
      where c.id = contribution_id
        and (
          c.moderation_status = 'published'
          or c.user_id = auth.uid()
          or public.is_moderator()
        )
    )
    or created_by = auth.uid()
    or public.is_moderator()
  );

create policy "policy_evidence_insert_own"
  on public.policy_evidence
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- import_sources: public read active stubs; no client writes
-- ---------------------------------------------------------------------------

create policy "import_sources_select_active"
  on public.import_sources
  for select
  to anon, authenticated
  using (is_active = true or public.is_moderator());

-- ---------------------------------------------------------------------------
-- promote_policy_contribution
-- ---------------------------------------------------------------------------

create or replace function public.promote_policy_contribution(contribution_id uuid)
returns public.dog_policies
language plpgsql
security definer
set search_path = public
as $$
declare
  contrib public.policy_contributions%rowtype;
  prev public.dog_policies%rowtype;
  result public.dog_policies%rowtype;
  caller uuid := auth.uid();
  is_mod boolean;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select * into contrib
  from public.policy_contributions
  where id = contribution_id
  for update;

  if not found then
    raise exception 'Contribution % not found', contribution_id;
  end if;

  is_mod := public.is_moderator();

  if contrib.user_id is distinct from caller and not is_mod then
    raise exception 'Not allowed to promote this contribution';
  end if;

  -- Owner may promote own contribution after marking published; moderators may promote any.
  if contrib.moderation_status <> 'published' then
    if (contrib.user_id = caller) or is_mod then
      update public.policy_contributions
      set moderation_status = 'published',
          updated_at = now()
      where id = contribution_id
      returning * into contrib;
    else
      raise exception 'Contribution must be published before promote';
    end if;
  end if;

  -- Snapshot previous canonical policy into append-only history
  select * into prev
  from public.dog_policies
  where place_id = contrib.place_id
  for update;

  if found then
    insert into public.dog_policy_versions (
      place_id,
      dog_policy_id,
      dog_status,
      access,
      max_dogs,
      max_weight_kg,
      max_combined_weight_kg,
      small_dogs_only,
      carrier_required,
      leash_required,
      advance_approval_required,
      fee_type,
      fee_amount,
      fee_currency,
      exception_text,
      confidence,
      last_verified_at,
      promoted_from_contribution_id,
      snapshot_at
    ) values (
      prev.place_id,
      prev.id,
      prev.dog_status,
      prev.access,
      prev.max_dogs,
      prev.max_weight_kg,
      prev.max_combined_weight_kg,
      prev.small_dogs_only,
      prev.carrier_required,
      prev.leash_required,
      prev.advance_approval_required,
      prev.fee_type,
      prev.fee_amount,
      prev.fee_currency,
      prev.exception_text,
      prev.confidence,
      prev.last_verified_at,
      prev.promoted_from_contribution_id,
      now()
    );
  end if;

  insert into public.dog_policies (
    place_id,
    dog_status,
    access,
    max_dogs,
    max_weight_kg,
    max_combined_weight_kg,
    small_dogs_only,
    carrier_required,
    leash_required,
    advance_approval_required,
    fee_type,
    fee_amount,
    fee_currency,
    exception_text,
    confidence,
    last_verified_at,
    promoted_from_contribution_id
  ) values (
    contrib.place_id,
    contrib.dog_status,
    contrib.access,
    contrib.max_dogs,
    contrib.max_weight_kg,
    contrib.max_combined_weight_kg,
    contrib.small_dogs_only,
    contrib.carrier_required,
    contrib.leash_required,
    contrib.advance_approval_required,
    contrib.fee_type,
    contrib.fee_amount,
    contrib.fee_currency,
    contrib.exception_text,
    case when is_mod then 0.85 else 0.70 end,
    coalesce(contrib.observed_at::timestamptz, now()),
    contrib.id
  )
  on conflict (place_id) do update set
    dog_status = excluded.dog_status,
    access = excluded.access,
    max_dogs = excluded.max_dogs,
    max_weight_kg = excluded.max_weight_kg,
    max_combined_weight_kg = excluded.max_combined_weight_kg,
    small_dogs_only = excluded.small_dogs_only,
    carrier_required = excluded.carrier_required,
    leash_required = excluded.leash_required,
    advance_approval_required = excluded.advance_approval_required,
    fee_type = excluded.fee_type,
    fee_amount = excluded.fee_amount,
    fee_currency = excluded.fee_currency,
    exception_text = excluded.exception_text,
    confidence = excluded.confidence,
    last_verified_at = excluded.last_verified_at,
    promoted_from_contribution_id = excluded.promoted_from_contribution_id,
    updated_at = now()
  returning * into result;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, payload)
  values (
    caller,
    'promote_policy_contribution',
    'dog_policies',
    result.id,
    jsonb_build_object(
      'contribution_id', contrib.id,
      'place_id', contrib.place_id,
      'previous_policy_id', prev.id,
      'dog_status', result.dog_status
    )
  );

  return result;
end;
$$;

revoke all on function public.promote_policy_contribution(uuid) from public;
grant execute on function public.promote_policy_contribution(uuid) to authenticated;
