-- Migration 013 — Hale Pâtisserie identity place (Coral Gables)
-- Neutral cafe on the map: no dog_policies row until evidence exists.
-- Canonical slug matches public URL; short slug remapped if present.

-- Remap short slug if an older seed already used it
update public.places
set slug = 'hale-patisserie-coral-gables',
    name = 'Hale Pâtisserie',
    category = 'cafe',
    city = 'Coral Gables',
    region = 'FL',
    postal_code = '33134',
    address_line1 = '2301 Galiano St',
    lat = 25.7497,
    lng = -80.2589,
    location = st_setsrid(st_makepoint(-80.2589, 25.7497), 4326)::geography,
    address = '{"line1":"2301 Galiano St","city":"Coral Gables","region":"FL","postal_code":"33134"}'::jsonb,
    source_type = 'curated',
    source_attribution = 'Dogmarked curated seed (identity only — no policy)',
    status = 'active',
    updated_at = now()
where slug = 'hale-patisserie'
   or id = 'a1000000-0000-4000-8000-000000000009';

insert into public.places (
  id, name, slug, category, location, lat, lng, country_code,
  address_line1, city, region, postal_code, address,
  website, phone, status, source_type, source_attribution
) values (
  'a1000000-0000-4000-8000-000000000009',
  'Hale Pâtisserie',
  'hale-patisserie-coral-gables',
  'cafe',
  st_setsrid(st_makepoint(-80.2589, 25.7497), 4326)::geography,
  25.7497,
  -80.2589,
  'US',
  '2301 Galiano St',
  'Coral Gables',
  'FL',
  '33134',
  '{"line1":"2301 Galiano St","city":"Coral Gables","region":"FL","postal_code":"33134"}'::jsonb,
  null,
  null,
  'active',
  'curated',
  'Dogmarked curated seed (identity only — no policy)'
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  category = excluded.category,
  location = excluded.location,
  lat = excluded.lat,
  lng = excluded.lng,
  address_line1 = excluded.address_line1,
  city = excluded.city,
  region = excluded.region,
  postal_code = excluded.postal_code,
  address = excluded.address,
  source_type = excluded.source_type,
  source_attribution = excluded.source_attribution,
  status = 'active',
  updated_at = now();

-- If a different row already owns the coral-gables slug, keep that row active
-- and point the fixed id at it only when slug is free (handled above via upsert).
-- Ensure no dog_policies for this identity-only place.
delete from public.dog_policies
where place_id = 'a1000000-0000-4000-8000-000000000009';
