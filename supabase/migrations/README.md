# Dogmarked migrations (numbered)

Apply in order on hosted Supabase (SQL Editor or CLI).  
**Filename convention for new files:**

```text
YYYYMMDDHHMMSS_NNN_short_snake_description.sql
```

- `NNN` = sequential migration number (`009`, `010`, …) — use this when talking about “run migration 9”
- Timestamp keeps Supabase CLI ordering stable
- First line of every new file: `-- Migration NNN — short title`

## Ledger

| # | File | Purpose | Hosted |
|---|---|---|---|
| 000 | `20260304120000_enable_postgis.sql` | PostGIS | ✅ |
| 001 | `20260304120100_core_schema.sql` | Core tables / enums | ✅ |
| 002 | `20260304120200_rls_and_promote.sql` | RLS + promote RPC | ✅ |
| 003 | `20260304120300_affiliates_and_collections.sql` | Collections, follows, affiliates | ✅ |
| 004 | `20260304120400_places_location_sync.sql` | Sync `location` from lat/lng | ✅ |
| 005 | `20260304120500_public_profile_saves.sql` | Public profile / saves RPCs | ✅ |
| 006 | `20260304120600_policy_reports.sql` | Policy reports | ✅ |
| 007 | `20260304120700_seasonal_and_profile_contribs.sql` | Seasonal fields + contribution history | ✅ |
| 008 | `20260304120800_008_affiliate_click_reporting.sql` | Affiliate click events + partner report RPCs | ✅ |
| 009 | `20260304120900_009_merge_places.sql` | Duplicate merge + candidate list RPCs | ✅ |
| 010 | `20260304121000_010_place_photos_storage.sql` | `place-photos` Storage bucket + policies | ✅ |
| 011 | `20260304121100_011_place_claims.sql` | Business claim stub + review RPC | ✅ |
| 012 | `20260304121200_012_profile_rls_external_refs.sql` | Profile ensure trigger, contribution RLS harden, `external_place_refs` | ✅ |
| 013 | `20260304121300_013_hale_patisserie_seed.sql` | Hale Pâtisserie Coral Gables identity place | ✅ |

**Next file to add:** `YYYYMMDDHHMMSS_014_<description>.sql`

When you apply a migration on hosted Supabase, check it off in this table (and in `tasks.md`).
