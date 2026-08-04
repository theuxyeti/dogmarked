-- Phase 1 seed: curated South Florida places + bootstrap dog_policies.
-- NOTE: Production promotes contributions via promote_policy_contribution() RPC.
-- This seed inserts dog_policies directly for local bootstrap only.

-- Placeholder photos with licensing unknown (storage_path null).

insert into public.places (
  id, name, slug, category, location, lat, lng, country_code,
  address_line1, city, region, postal_code, address, website, phone,
  status, source_type, source_attribution
) values
  (
    'a1000000-0000-4000-8000-000000000001',
    'Red Reef Park',
    'red-reef-park-boca-raton',
    'park',
    st_setsrid(st_makepoint(-80.0705, 26.3558), 4326)::geography,
    26.3558, -80.0705, 'US',
    '1400 N Ocean Blvd', 'Boca Raton', 'FL', '33432',
    '{"line1":"1400 N Ocean Blvd","city":"Boca Raton","region":"FL","postal_code":"33432"}'::jsonb,
    'https://www.myboca.us/Facilities/Facility/Details/Red-Reef-Park-7',
    null,
    'active', 'curated', 'Dogmarked curated seed'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Spanish River Park',
    'spanish-river-park-boca-raton',
    'park',
    st_setsrid(st_makepoint(-80.0692, 26.3855), 4326)::geography,
    26.3855, -80.0692, 'US',
    '3001 N Ocean Blvd', 'Boca Raton', 'FL', '33431',
    '{"line1":"3001 N Ocean Blvd","city":"Boca Raton","region":"FL","postal_code":"33431"}'::jsonb,
    null,
    null,
    'active', 'curated', 'Dogmarked curated seed'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'Lauderdale-by-the-Sea Dog Beach',
    'lauderdale-by-the-sea-dog-beach',
    'beach',
    st_setsrid(st_makepoint(-80.0940, 26.1915), 4326)::geography,
    26.1915, -80.0940, 'US',
    'El Prado Park / oceanfront', 'Lauderdale-by-the-Sea', 'FL', '33308',
    '{"line1":"El Prado Park","city":"Lauderdale-by-the-Sea","region":"FL","postal_code":"33308"}'::jsonb,
    'https://www.lbts-fl.gov/',
    null,
    'active', 'curated', 'Dogmarked curated seed'
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'Barkingham Dog Park',
    'barkingham-dog-park-fort-lauderdale',
    'park',
    st_setsrid(st_makepoint(-80.1508, 26.1180), 4326)::geography,
    26.1180, -80.1508, 'US',
    '1600 SW 15th Ave', 'Fort Lauderdale', 'FL', '33312',
    '{"line1":"1600 SW 15th Ave","city":"Fort Lauderdale","region":"FL","postal_code":"33312"}'::jsonb,
    null,
    null,
    'active', 'curated', 'Dogmarked curated seed'
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    'The Salty Donut Wynwood',
    'salty-donut-wynwood-miami',
    'cafe',
    st_setsrid(st_makepoint(-80.1998, 25.8007), 4326)::geography,
    25.8007, -80.1998, 'US',
    '3451 NE 1st Ave', 'Miami', 'FL', '33137',
    '{"line1":"3451 NE 1st Ave","city":"Miami","region":"FL","postal_code":"33137"}'::jsonb,
    'https://www.saltydonut.com/',
    null,
    'active', 'curated', 'Dogmarked curated seed'
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    'Yardbird Southern Table & Bar',
    'yardbird-miami-beach',
    'restaurant',
    st_setsrid(st_makepoint(-80.1400, 25.7908), 4326)::geography,
    25.7908, -80.1400, 'US',
    '1600 Lenox Ave', 'Miami Beach', 'FL', '33139',
    '{"line1":"1600 Lenox Ave","city":"Miami Beach","region":"FL","postal_code":"33139"}'::jsonb,
    'https://www.runchickenrun.com/miami/',
    null,
    'active', 'curated', 'Dogmarked curated seed'
  ),
  (
    'a1000000-0000-4000-8000-000000000007',
    'Kimpton Surfer Hotel',
    'kimpton-surfer-hotel-miami-beach',
    'hotel',
    st_setsrid(st_makepoint(-80.1295, 25.7790), 4326)::geography,
    25.7790, -80.1295, 'US',
    '1052 Collins Ave', 'Miami Beach', 'FL', '33139',
    '{"line1":"1052 Collins Ave","city":"Miami Beach","region":"FL","postal_code":"33139"}'::jsonb,
    'https://www.surferhotel.com/',
    null,
    'active', 'curated', 'Dogmarked curated seed'
  ),
  (
    'a1000000-0000-4000-8000-000000000008',
    'Mizner Park Amphitheater Lawn',
    'mizner-park-lawn-boca-raton',
    'park',
    st_setsrid(st_makepoint(-80.0855, 26.3620), 4326)::geography,
    26.3620, -80.0855, 'US',
    '590 Plaza Real', 'Boca Raton', 'FL', '33432',
    '{"line1":"590 Plaza Real","city":"Boca Raton","region":"FL","postal_code":"33432"}'::jsonb,
    null,
    null,
    'active', 'curated', 'Dogmarked curated seed'
  )
on conflict (id) do nothing;

-- Canonical dog policies (bootstrap). Sugar/Munch-relevant notes baked into exception_text.
insert into public.dog_policies (
  place_id, dog_status, access, max_dogs, max_weight_kg, max_combined_weight_kg,
  small_dogs_only, carrier_required, leash_required, advance_approval_required,
  fee_type, fee_amount, fee_currency, exception_text, confidence, last_verified_at
) values
  -- Parks: both dogs typically fine on leash
  (
    'a1000000-0000-4000-8000-000000000001',
    'dogs_ok_with_restrictions',
    array['outdoor', 'paths', 'beach_adjacent'],
    null, null, null,
    false, false, true, false,
    'none', null, 'USD',
    'Leashed dogs on park paths; confirm beach zone rules before bringing Sugar and Munch.',
    0.80, now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'dogs_welcome',
    array['outdoor', 'paths', 'picnic'],
    null, null, null,
    false, false, true, false,
    'none', null, 'USD',
    'Good dual-dog outing; keep both leashed on trails and near playgrounds.',
    0.75, now()
  ),
  -- Dog beach: both dogs welcome
  (
    'a1000000-0000-4000-8000-000000000003',
    'dogs_welcome',
    array['beach', 'off_leash_zone', 'outdoor'],
    null, null, null,
    false, false, false, false,
    'none', null, 'USD',
    'Designated dog beach hours/rules apply. Works well for Sugar + Munch together.',
    0.85, now()
  ),
  -- Dog park: off-leash fenced
  (
    'a1000000-0000-4000-8000-000000000004',
    'dogs_welcome',
    array['outdoor', 'fenced', 'off_leash_zone'],
    null, null, null,
    false, false, false, false,
    'none', null, 'USD',
    'Separate small/large areas — useful if Sugar and Munch prefer different play styles.',
    0.80, now()
  ),
  -- Cafe: patio dogs, ask about two dogs
  (
    'a1000000-0000-4000-8000-000000000005',
    'dogs_ok_outdoors',
    array['patio', 'outdoor_seating'],
    2, null, null,
    false, false, true, false,
    'none', null, 'USD',
    'Patio dogs typically OK. Confirm capacity for two dogs (Sugar + Munch) at peak times.',
    0.70, now()
  ),
  -- Restaurant: Ask first, max_dogs=1 — one of Sugar/Munch only unless approved
  (
    'a1000000-0000-4000-8000-000000000006',
    'ask_first',
    array['patio'],
    1, null, null,
    false, false, true, true,
    'none', null, 'USD',
    'Ask first: patio dog policy often max_dogs=1. Bring Sugar or Munch alone unless staff approves both.',
    0.65, now()
  ),
  -- Hotel: pet fee, weight-aware for multi-dog travel
  (
    'a1000000-0000-4000-8000-000000000007',
    'dogs_ok_with_restrictions',
    array['rooms', 'lobby', 'outdoor'],
    2, 36.0, 45.0,
    false, false, true, true,
    'flat', 150.00, 'USD',
    'Pet fee; confirm combined weight for Sugar + Munch and advance approval before booking.',
    0.75, now()
  ),
  -- Mizner lawn: leashed, public green
  (
    'a1000000-0000-4000-8000-000000000008',
    'dogs_ok_with_restrictions',
    array['outdoor', 'lawn'],
    null, null, null,
    false, false, true, false,
    'none', null, 'USD',
    'Leashed dogs on public lawn areas; event days may restrict access.',
    0.70, now()
  )
on conflict (place_id) do nothing;

-- Placeholder photos: no storage path; licensing unknown (excluded from public photo SELECT)
insert into public.place_photos (
  place_id, source_type, source_url, attribution_text, license,
  storage_permission, storage_path, is_primary, is_evidence
)
select
  p.id,
  'placeholder',
  null,
  'Placeholder — licensing unknown; do not permanently store until cleared',
  'unknown',
  'unknown',
  null,
  true,
  false
from public.places p
where p.id in (
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-000000000006',
  'a1000000-0000-4000-8000-000000000007',
  'a1000000-0000-4000-8000-000000000008'
)
and not exists (
  select 1 from public.place_photos ph where ph.place_id = p.id and ph.is_primary
);

insert into public.import_sources (name, description, is_active, license_notes)
values (
  'manual_curated_seed',
  'Phase 1 curated South Florida bootstrap places',
  false,
  'Editorial curation; verify policies independently'
)
on conflict (name) do nothing;
