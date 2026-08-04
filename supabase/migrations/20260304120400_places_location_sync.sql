-- Keep PostGIS location in sync with lat/lng for user-created places.
-- Clients may send EWKT or rely on this trigger when lat/lng are set.

create or replace function public.places_sync_location()
returns trigger
language plpgsql
as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  end if;
  return new;
end;
$$;

drop trigger if exists places_sync_location on public.places;
create trigger places_sync_location
  before insert or update of lat, lng
  on public.places
  for each row
  execute function public.places_sync_location();
