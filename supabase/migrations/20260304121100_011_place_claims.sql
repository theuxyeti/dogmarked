-- Migration 011 — place claims stub
-- Phase 7: business owners can request control. No auto-trust of dog_policies.

do $$ begin
  create type public.place_claim_status as enum (
    'pending',
    'approved',
    'rejected',
    'revoked'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.place_claims (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  business_name text,
  contact_email text not null,
  contact_phone text,
  proof_url text,
  proof_note text,
  status public.place_claim_status not null default 'pending',
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, claimant_id)
);

create index if not exists place_claims_place_idx on public.place_claims (place_id);
create index if not exists place_claims_status_idx on public.place_claims (status);
create index if not exists place_claims_claimant_idx on public.place_claims (claimant_id);

drop trigger if exists place_claims_set_updated_at on public.place_claims;
create trigger place_claims_set_updated_at
  before update on public.place_claims
  for each row execute function public.set_updated_at();

alter table public.place_claims enable row level security;

drop policy if exists place_claims_insert_own on public.place_claims;
create policy place_claims_insert_own on public.place_claims
  for insert
  to authenticated
  with check (
    claimant_id = auth.uid()
    and status = 'pending'
  );

drop policy if exists place_claims_select_own_or_moderator on public.place_claims;
create policy place_claims_select_own_or_moderator on public.place_claims
  for select
  to authenticated
  using (
    claimant_id = auth.uid()
    or public.is_moderator()
  );

drop policy if exists place_claims_update_moderator on public.place_claims;
create policy place_claims_update_moderator on public.place_claims
  for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- Moderator review helper (does not grant dog_policies write)
create or replace function public.review_place_claim(
  p_claim_id uuid,
  p_status public.place_claim_status,
  p_reviewer_note text default null
)
returns public.place_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  result public.place_claims%rowtype;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  if p_status not in ('approved', 'rejected', 'revoked') then
    raise exception 'Invalid review status';
  end if;

  update public.place_claims
  set status = p_status,
      reviewer_id = caller,
      reviewer_note = p_reviewer_note,
      reviewed_at = now(),
      updated_at = now()
  where id = p_claim_id
  returning * into result;

  if not found then
    raise exception 'Claim % not found', p_claim_id;
  end if;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, payload)
  values (
    caller,
    'place_claim.review',
    'place_claim',
    result.id,
    jsonb_build_object(
      'place_id', result.place_id,
      'claimant_id', result.claimant_id,
      'status', result.status,
      'reviewer_note', p_reviewer_note
    )
  );

  return result;
end;
$$;

revoke all on function public.review_place_claim(uuid, public.place_claim_status, text) from public;
grant execute on function public.review_place_claim(uuid, public.place_claim_status, text) to authenticated;
