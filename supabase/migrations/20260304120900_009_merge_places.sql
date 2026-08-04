-- Migration 009 — merge places RPC
-- Phase 7: moderator-only duplicate merge. Reparents children, marks loser duplicate_merged.
-- Does not write dog_policies from clients; keeps survivor canonical policy.

create or replace function public.merge_places(
  p_survivor_place_id uuid,
  p_loser_place_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  survivor public.places%rowtype;
  loser public.places%rowtype;
  caller uuid := auth.uid();
  moved jsonb := '{}'::jsonb;
  n int;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  if p_survivor_place_id is null
     or p_loser_place_id is null
     or p_survivor_place_id = p_loser_place_id then
    raise exception 'survivor and loser must be distinct';
  end if;

  select * into survivor
  from public.places
  where id = p_survivor_place_id
  for update;

  if not found then
    raise exception 'Survivor place % not found', p_survivor_place_id;
  end if;

  if survivor.status = 'duplicate_merged' then
    raise exception 'Survivor is already merged';
  end if;

  select * into loser
  from public.places
  where id = p_loser_place_id
  for update;

  if not found then
    raise exception 'Loser place % not found', p_loser_place_id;
  end if;

  if loser.status = 'duplicate_merged' then
    raise exception 'Loser is already merged';
  end if;

  -- Saves: move or drop on (user_id, place_id) conflict
  update public.user_place_saves s
  set place_id = p_survivor_place_id,
      updated_at = now()
  where s.place_id = p_loser_place_id
    and not exists (
      select 1
      from public.user_place_saves x
      where x.user_id = s.user_id
        and x.place_id = p_survivor_place_id
    );
  get diagnostics n = row_count;
  delete from public.user_place_saves where place_id = p_loser_place_id;
  moved := moved || jsonb_build_object('user_place_saves_moved', n);

  -- Canonical policy: keep survivor; snapshot + delete loser if both exist
  if exists (select 1 from public.dog_policies where place_id = p_loser_place_id) then
    if exists (select 1 from public.dog_policies where place_id = p_survivor_place_id) then
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
        seasonal_notes,
        seasonal_start_month,
        seasonal_end_month,
        confidence,
        last_verified_at,
        promoted_from_contribution_id,
        snapshot_at
      )
      select
        place_id,
        id,
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
        seasonal_notes,
        seasonal_start_month,
        seasonal_end_month,
        confidence,
        last_verified_at,
        promoted_from_contribution_id,
        now()
      from public.dog_policies
      where place_id = p_loser_place_id;

      delete from public.dog_policies where place_id = p_loser_place_id;
      moved := moved || jsonb_build_object('dog_policies', 'kept_survivor_snapshotted_loser');
    else
      update public.dog_policies
      set place_id = p_survivor_place_id,
          updated_at = now()
      where place_id = p_loser_place_id;
      moved := moved || jsonb_build_object('dog_policies', 'moved_to_survivor');
    end if;
  end if;

  update public.dog_policy_versions
  set place_id = p_survivor_place_id
  where place_id = p_loser_place_id;

  update public.policy_contributions
  set place_id = p_survivor_place_id,
      updated_at = now()
  where place_id = p_loser_place_id;

  if exists (
    select 1
    from public.place_photos
    where place_id = p_survivor_place_id
      and is_primary
  ) then
    update public.place_photos
    set is_primary = false,
        updated_at = now()
    where place_id = p_loser_place_id
      and is_primary;
  end if;

  update public.place_photos
  set place_id = p_survivor_place_id,
      updated_at = now()
  where place_id = p_loser_place_id;

  update public.policy_evidence
  set place_id = p_survivor_place_id
  where place_id = p_loser_place_id;

  if to_regclass('public.policy_reports') is not null then
    execute 'update public.policy_reports set place_id = $1 where place_id = $2'
      using p_survivor_place_id, p_loser_place_id;
  end if;

  update public.collection_places cp
  set place_id = p_survivor_place_id
  where cp.place_id = p_loser_place_id
    and not exists (
      select 1
      from public.collection_places x
      where x.collection_id = cp.collection_id
        and x.place_id = p_survivor_place_id
    );
  delete from public.collection_places where place_id = p_loser_place_id;

  update public.collections
  set cover_place_id = p_survivor_place_id
  where cover_place_id = p_loser_place_id;

  update public.affiliate_links
  set place_id = p_survivor_place_id,
      updated_at = now()
  where place_id = p_loser_place_id;

  if to_regclass('public.affiliate_click_events') is not null then
    execute 'update public.affiliate_click_events set place_id = $1 where place_id = $2'
      using p_survivor_place_id, p_loser_place_id;
  end if;

  if to_regclass('public.place_claims') is not null then
    execute $q$
      update public.place_claims c
      set place_id = $1,
          updated_at = now()
      where c.place_id = $2
        and not exists (
          select 1
          from public.place_claims x
          where x.place_id = $1
            and x.claimant_id = c.claimant_id
        )
    $q$ using p_survivor_place_id, p_loser_place_id;
    execute 'delete from public.place_claims where place_id = $1'
      using p_loser_place_id;
  end if;

  update public.places
  set duplicate_of_place_id = p_survivor_place_id,
      updated_at = now()
  where duplicate_of_place_id = p_loser_place_id;

  update public.places
  set status = 'duplicate_merged',
      duplicate_of_place_id = p_survivor_place_id,
      updated_at = now()
  where id = p_loser_place_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, payload)
  values (
    caller,
    'place.merge',
    'place',
    p_survivor_place_id,
    jsonb_build_object(
      'survivor_place_id', p_survivor_place_id,
      'loser_place_id', p_loser_place_id,
      'loser_slug', loser.slug,
      'survivor_slug', survivor.slug,
      'note', p_note,
      'moved', moved
    )
  );

  return jsonb_build_object(
    'ok', true,
    'survivor_place_id', p_survivor_place_id,
    'loser_place_id', p_loser_place_id,
    'survivor_slug', survivor.slug,
    'loser_slug', loser.slug,
    'moved', moved
  );
end;
$$;

revoke all on function public.merge_places(uuid, uuid, text) from public;
grant execute on function public.merge_places(uuid, uuid, text) to authenticated;

-- Candidate duplicates for moderators (name + ~150m proximity)
create or replace function public.list_duplicate_place_candidates(
  p_limit integer default 25
)
returns table (
  place_a_id uuid,
  place_a_slug text,
  place_a_name text,
  place_b_id uuid,
  place_b_slug text,
  place_b_name text,
  distance_m double precision
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  return query
  select
    a.id as place_a_id,
    a.slug as place_a_slug,
    a.name as place_a_name,
    b.id as place_b_id,
    b.slug as place_b_slug,
    b.name as place_b_name,
    st_distance(a.location, b.location)::double precision as distance_m
  from public.places a
  join public.places b
    on a.id < b.id
   and a.status = 'active'
   and b.status = 'active'
   and a.location is not null
   and b.location is not null
   and st_dwithin(a.location, b.location, 150)
   and lower(a.name) = lower(b.name)
  order by distance_m asc
  limit v_limit;
end;
$$;

revoke all on function public.list_duplicate_place_candidates(integer) from public;
grant execute on function public.list_duplicate_place_candidates(integer) to authenticated;
