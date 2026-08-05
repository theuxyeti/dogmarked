# Dogmarked — Phase Roadmap

Living progress tracker. Architecture: [`master-build-plan.md`](./master-build-plan.md).  
Visual system: [`design-system.md`](./design-system.md).  
Active plan: **Dogmarked Pet-First Map and Visual Experience** (Cursor `smart_nearby_discovery_ae063e17`). In-repo checklist: [`tasks.md`](../tasks.md).

**Product question:** Where can Sugar and Munch actually go, and what should we know before arriving?

**Visual north star:** Modern Travel Field Guide — map-first, warm, premium, joyful through pets and category markers — not a generic map dashboard.

---

## Current focus

**Status:** Phase 12 — Pet-First Map and Visual Experience **complete**  
**Hosted:** Migrations **016–018** applied  
**Foundation:** Smart Nearby Discovery (Phases 1–5) complete — do not reimplement unless regression

---

## Foundation complete

| Area | Status |
|---|---|
| Phase 10 simplified MVP chrome | ✅ |
| On-demand Foursquare nearby + selective save | ✅ |
| Pin / radius / Search this area | ✅ |
| My Places + Community layers | ✅ |
| Selected-place enrichment + `place_provider_cache` | ✅ |
| Migrations 014–015 | ✅ hosted |
| MapTiler fallback when FSQ fails | ✅ |

---

## Phase 12 — Pet-First Map and Visual Experience *(complete)*

| Item | Status |
|---|---|
| **6A** Modern Travel Field Guide visual system | ✅ |
| 6 — Pet identity + clickable account avatar | ✅ |
| 7 — Semantic category markers + policy shells | ✅ |
| 8 — Structured policy evidence + summaries | ✅ |
| 9 — Rich place card 2.0 (travel-guide) | ✅ |
| 10 — Trip reports + note suggestions + official sources | ✅ |
| 11 — Provider-neutral official/Booking links | ✅ |
| 12 — Tips off by default; RLS / a11y / visual QA / build | ✅ (build + unit/RLS tests green) |

**Cost defaults verified:** `FSQ_TIPS_ENABLED=false`; `BOOKING_LINKS_ENABLED=true`; affiliate/Demand API off. No pan/zoom paid discovery; tips gated; photos after selection; save not blocked by enrichment failure.

**Visual apply order:** Explore header → search → map controls → markers → nearby → drawer → mobile sheet → pet identity → trip reports → then secondary pages.

---

## Deferred (future backlog)

Global FSQ OS imports, PMTiles, coverage polygons, Redis, affiliate Demand API / affiliate CTAs before approval, generic social feed, likes/stars, gamification, Storybook-only tooling.

---

## Earlier phases

Phases 0–11 delivered infrastructure through Smart Nearby Discovery. See `master-build-plan.md` for historical checklists.
