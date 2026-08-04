-- Migration 007 — seasonal policy fields + contribution history RPC
-- Phase 5: seasonal policy fields + promote RPC update
-- Phase 6: public contribution history for profiles

alter table public.policy_contributions
  add column if not exists seasonal_notes text,
  add column if not exists seasonal_start_month smallint
    check (seasonal_start_month is null or seasonal_start_month between 1 and 12),
  add column if not exists seasonal_end_month smallint
    check (seasonal_end_month is null or seasonal_end_month between 1 and 12);

alter table public.dog_policies
  add column if not exists seasonal_notes text,
  add column if not exists seasonal_start_month smallint
    check (seasonal_start_month is null or seasonal_start_month between 1 and 12),
  add column if not exists seasonal_end_month smallint
    check (seasonal_end_month is null or seasonal_end_month between 1 and 12);

alter table public.dog_policy_versions
  add column if not exists seasonal_notes text,
  add column if not exists seasonal_start_month smallint
    check (seasonal_start_month is null or seasonal_start_month between 1 and 12),
  add column if not exists seasonal_end_month smallint
    check (seasonal_end_month is null or seasonal_end_month between 1 and 12);

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
      seasonal_notes,
      seasonal_start_month,
      seasonal_end_month,
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
      prev.seasonal_notes,
      prev.seasonal_start_month,
      prev.seasonal_end_month,
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
    seasonal_notes,
    seasonal_start_month,
    seasonal_end_month,
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
    contrib.seasonal_notes,
    contrib.seasonal_start_month,
    contrib.seasonal_end_month,
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
    seasonal_notes = excluded.seasonal_notes,
    seasonal_start_month = excluded.seasonal_start_month,
    seasonal_end_month = excluded.seasonal_end_month,
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

create or replace function public.list_public_contributions_for_handle(p_handle text)
returns table (
  contribution_id uuid,
  place_id uuid,
  place_name text,
  place_slug text,
  dog_status public.dog_status,
  observed_at date,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.place_id,
    p.name,
    p.slug,
    c.dog_status,
    c.observed_at,
    c.created_at
  from public.profiles pr
  join public.policy_contributions c on c.user_id = pr.id
  join public.places p on p.id = c.place_id
  where lower(pr.handle) = lower(p_handle)
    and c.moderation_status = 'published'
    and p.status = 'active'
  order by c.created_at desc
  limit 50;
$$;

revoke all on function public.list_public_contributions_for_handle(text) from public;
grant execute on function public.list_public_contributions_for_handle(text) to anon, authenticated;
