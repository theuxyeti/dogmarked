<tldr>
Phases 1–4 largely wired; Community now loads live public maps/verified places. **You:** apply migrations `…204`, `…205`, `…206` on hosted Supabase, then smoke-test.
</tldr>

## Needs you

- [ ] Apply on Supabase SQL Editor:
  - `20260304120400_places_location_sync.sql`
  - `20260304120500_public_profile_saves.sql`
  - `20260304120600_policy_reports.sql`
- [ ] Live smoke: sign in → create place → save (visibility) → collection → publish → report

## Active (code)

- [ ] Breakpoint QA (Phase 2)
- [ ] Evidence photo uploads with licensing (Phase 4)
- [ ] Follow graph persistence (Phase 6)
- [ ] OSM import job (Phase 7)

## Done recently

- [x] Collections API + create/detail/share visibility
- [x] Public `/u/[handle]` + public saves RPC
- [x] Save visibility private/link/public
- [x] Report incorrect + mark closed
- [x] Moderation queue loads live contributions/reports
- [x] Policy form on Add + policy history on place page
- [x] Community tab from Supabase (public collections / verified / needs check)
