<tldr>
**Why production looks unchanged:** Phase 3–9 UI is mostly **uncommitted / not deployed**. Migrations 000–013 are on Supabase, but `dogmarked.vercel.app` still serves older app code (header still says “Saved”).
</tldr>

## Blocker — deploy

- [ ] Commit + push feature branch (or merge to the branch Vercel uses) so preview/production picks up Phase 9
- [ ] Confirm Hale: `/place/hale-patisserie-coral-gables` after deploy

## Applied

- [x] Migrations **000–013** on hosted Supabase

## Smoke after deploy

- [ ] Header shows **My Places** (not Saved); avatar menu when signed in
- [ ] Explore: basemap POI click → What’s here?; Dogmarked pins colored by policy
- [ ] Hale page: “not marked dog-friendly until evidence”
- [ ] Contribution submit without raw RLS error

## Local fixes this pass

- Mobile/tablet brand bar (was missing below `xl`)
- Unverified markers styled distinctly
- Hale slug + migration 013
- Clearer empty-policy place copy
