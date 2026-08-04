# South Florida OSM dog-tag import runbook

Import dog-policy *hints* from OpenStreetMap only. Do **not** scrape Google, Mapstr, BringFido, Yelp, or other commercial directories.

## Scope

- Region: South Florida bbox (approx. Miami-Dade / Broward / Palm Beach)
- Suggested bbox: `-80.90,25.10,-80.00,27.00` (west,south,east,north)
- Tags of interest: `dog=*`, `dogs=*`, `dog:tourism=*`, related access tags on amenity/leisure/tourism

## Overpass query (example)

Use [Overpass Turbo](https://overpass-turbo.eu/) or `overpass-turbo` CLI. Respect Overpass fair-use; run off-peak for large extracts.

```
[out:json][timeout:180];
(
  node["dog"](25.10,-80.90,27.00,-80.00);
  way["dog"](25.10,-80.90,27.00,-80.00);
  relation["dog"](25.10,-80.90,27.00,-80.00);
  node["dogs"](25.10,-80.90,27.00,-80.00);
  way["dogs"](25.10,-80.90,27.00,-80.00);
);
out center tags;
```

Export GeoJSON/JSON. Store the raw file outside Git if large; keep a small sample fixture in-repo if needed for tests.

## Mapping

1. Run rows through `src/lib/imports/osm-mapper.ts` → policy contribution *drafts* (never direct canonical writes).
2. Set provenance: `source_type=import`, attribution `© OpenStreetMap contributors`, confidence medium / `osm`.
3. Deduplicate against existing `places` (proximity + normalized name) before insert.
4. Images: OSM does not grant photo storage rights here — leave photos as placeholders/`link_only`.

## Load path

1. Admin UI stub: `/admin/imports`
2. Insert `places` + `policy_contributions` with `moderation_status=draft` or `in_review`
3. Promote only via server RPC / `supabase/functions/promote-policy`

## License reminder

OSM data is ODbL. Keep attribution. Do not mix in proprietary POI dumps.
