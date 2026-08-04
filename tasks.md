<tldr>
Living tracker: [`docs/roadmap.md`](docs/roadmap.md). Phase 1 core loop + Explore URL/filters + Saved status workflows + Add-by-location are in. Apply new migration `places_location_sync` on Supabase, then smoke-test live.
</tldr>

## Active

- [ ] Apply migration `20260304120400_places_location_sync.sql` on hosted Supabase
- [ ] Live smoke: sign in → create → save → change status on Saved → publish
- [ ] Breakpoint QA pass (Phase 2)

## Done this session

- [x] `docs/roadmap.md` phase board
- [x] Create place API + Add flow
- [x] Saves GET + Saved from Supabase
- [x] Auth-aware header
- [x] Explore URL state + category/policy/layer filters
- [x] Saved status change + remove
- [x] Add by current location + coordinates
