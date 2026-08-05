<tldr>
**Pet-First Map (Phases 6A–12)** is complete in repo and on hosted Supabase (migrations **016–018** applied).
</tldr>

## Active plan

Source: Cursor plan `smart_nearby_discovery_ae063e17`  
Docs: `docs/master-build-plan.md` · `docs/roadmap.md` · `docs/design-system.md`

### Completed (Phases 6A–12)

- [x] Audit Phases 1–5 for regressions only
- [x] **6A** Visual foundation — Modern Travel Field Guide tokens, primitives, motion, empty states
- [x] **6** Pet identity — clickable account nav; pets; active pack
- [x] **7** Semantic markers — category registry; policy shells; Known dog-friendly filter
- [x] **8** Structured policy evidence — reports, evidence, derived summaries
- [x] **9** Place card 2.0 — travel-guide hero, verdict, chips, trip feed
- [x] **10** Contributions — trip reports; note suggestions; official sources
- [x] **11** Place links — official / verified Booking stubs (`isAffiliate=false`)
- [x] **12** Cost/quality — `FSQ_TIPS_ENABLED=false` default; RLS matrix tests; build green

### Ops

- [x] Apply migration **016** on hosted Supabase
- [x] Apply migration **017** on hosted Supabase
- [x] Apply migration **018** on hosted Supabase

## Migration numbering

Applied through **018**. Next new file: **019+**.  
See `supabase/migrations/README.md`.
