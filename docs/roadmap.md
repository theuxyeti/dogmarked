# Dogmarked — Phase Roadmap

Living progress tracker for Phases **0–8**.  
Deep architecture, schema, and acceptance criteria live in [`master-build-plan.md`](./master-build-plan.md). **Update this file as work ships.**

**Product promise:** Build your own map of dog-friendly places, discover places shared by others, and understand the actual rules before you arrive.

**Foundation (do not collapse):** Location → personal save → public contribution → trusted canonical policy

---

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Done / verified in product |
| 🟡 | Scaffolded or partial — needs polish |
| ⬜ | Not started |
| 🔒 | Waiting on user checkpoint / external account |

---

## Current focus

**Active:** Phase 9 smoke (migrations **000–012** applied)  
**Next:** Breakpoint QA sign-off, MapTiler storage-rights confirmation, FSQ OS Places enrichment  
**Migrations:** numbered ledger in [`supabase/migrations/README.md`](../supabase/migrations/README.md) — next file is **013**

---

## Phase 0 — Repository and infrastructure

| Item | Status |
|---|---|
| Next.js + TypeScript + Tailwind scaffold | ✅ |
| `.gitignore`, `.env.example`, `README.md` | ✅ |
| GitHub repository | ✅ |
| Vercel project + env slots | ✅ |
| Supabase project + PostGIS migrations | ✅ |
| Auth callback + return-path | ✅ |
| Auth redirects (localhost / preview / production) | ✅ |
| MapTiler key wired (tiles + geocode adapter) | ✅ |
| Preview deploy + `/api/health` connectivity | ✅ |
| Profile auto-create trigger (`handle_new_user`) | ✅ |
| Production domain (optional) | 🔒 when ready |

---

## Phase 1 — Vertical slice (first product release)

| Item | Status |
|---|---|
| MapLibre + MapTiler Explore (map + list) | ✅ |
| Schema + RLS + seed | ✅ |
| Place detail (dog-first hierarchy) | ✅ |
| Auth + private save | ✅ |
| Saves API + Saved page | ✅ |
| Create place API + Add flow | ✅ |
| Contributions + server-only promote | ✅ |
| Auth-aware header + save vs publish UX | ✅ |
| Compatibility + geocoding + RLS tests | ✅ |

---

## Phase 2 — Map foundation hardening

| Item | Status |
|---|---|
| URL state for map / filters / selection | ✅ |
| Clustering, search-this-area, category + policy filters | ✅ |
| Desktop left/right panels; tablet drawers | ✅ |
| PWA baseline + geolocation states | ✅ |
| Breakpoint QA signed off | 🟡 |

---

## Phase 3 — Personal map depth

| Item | Status |
|---|---|
| Want / visited / recommended workflows | ✅ |
| Collections + shareable URLs | ✅ |
| Link visibility for saves/collections | ✅ |
| Add by address / map pin / current location / coordinates | ✅ |
| Public profile shell (`/u/[handle]`) | ✅ |

---

## Phase 4 — Policy intelligence and trust

| Item | Status |
|---|---|
| Full policy form | ✅ |
| Official policy vs known exception UX | ✅ |
| Evidence photos with licensing checks | ✅ |
| Permanent photo storage (`place-photos` bucket) | ✅ |
| Confirmations + report incorrect | ✅ |
| Conflict resolution + version history UI | ✅ |
| Moderation queue + audit log | ✅ |
| Closed-place handling | ✅ |

---

## Phase 5 — Matching and worldwide UX

| Item | Status |
|---|---|
| Multi-dog + combined weight + carrier edge cases | ✅ |
| kg/lb, currency display, locale dates | ✅ |
| i18n framework + EN strings | ✅ |
| Country address formatting + service-animal copy | ✅ |
| Seasonal policy display | ✅ |

---

## Phase 6 — Community discovery

| Item | Status |
|---|---|
| Follow users and collections | ✅ |
| Community tab surfaces | ✅ |
| Contribution history on profiles | ✅ |
| No algorithmic For You feed | ✅ (by design) |

---

## Phase 7 — Data enrichment

| Item | Status |
|---|---|
| South Florida OSM import with provenance | ✅ |
| Duplicate matching + merge tooling | ✅ |
| Import admin | ✅ |
| Licensed place-provider enrichment hooks | 🟡 |
| Business claim stub | ✅ |
| Confirm MapTiler storage rights before production scale | ⬜ |

---

## Phase 8 — Monetization

| Item | Status |
|---|---|
| Affiliate links, booking CTAs, disclosure, click attribution | ✅ |
| Partner reporting | ✅ |
| Promoted placements visually separated | ✅ |
| Confidence scoring ignores affiliate data | ✅ |

---

## Phase 9 — Map-first product refinement

| Item | Status |
|---|---|
| RLS / profile-ensure repair for contributions | ✅ |
| Place routes + no-link without canonical place | ✅ |
| Desktop panel XOR mobile sheet | ✅ |
| Auth UI + Save changes language | ✅ |
| Sugar & Munch seed + profile states | ✅ |
| MapTiler POI layers + PlaceProvider | ✅ |
| Unified map click + Explore search | ✅ |
| Responsive shell (My Places, avatar menu) | ✅ |
| Design system + shared place content | ✅ |
| Persist external_place_refs on contribute | ⬜ |
| FSQ OS Places live enrichment | ⬜ |
| Breakpoint QA signed off | 🟡 |

**Product rule:** basemap POIs are neutral context — never dog-friendly without Dogmarked policy evidence.

---

## Build order

1. Infrastructure (Phase 0) — **complete**
2. Core loop (Phase 1) — **complete**
3. Map hardening (Phase 2) — **QA left**
4. Personal maps (Phase 3) — **complete**
5. Trust / moderation (Phase 4) — **complete**
6. Worldwide matching (Phase 5) — **complete**
7. Community (Phase 6) — **complete**
8. Enrichment (Phase 7) — **complete** (merge / claims / storage)
9. Monetization (Phase 8) — **complete**
10. Map-first refinement (Phase 9) — **active**

---

## How we use this file

- Mark items ✅ when verified in the running app (not only when scaffolding exists).
- Keep 🟡 for UI/API stubs that do not complete the user loop yet.
- Prefer updating this roadmap in the same PR/session as the feature work.
- Do not collapse personal saves into public contributions or client-write canonical policies.
