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

**Active:** Apply hosted Supabase migrations + live smoke test  
**Next:** Breakpoint QA, then Phase 5 seasonal / Phase 7 OSM when ready

---

## Phase 0 — Repository and infrastructure

**Goal:** Reproducible GitHub → Vercel → Supabase → MapTiler stack with no secrets in Git.

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

**Phase 0 done when:** preview/production loads, Supabase + MapTiler healthy, auth redirects work, secrets stay out of Git.

---

## Phase 1 — Vertical slice (first product release)

**Goal:** Prove the full Dogmarked core loop before collections, following, or bulk imports.

| Item | Status |
|---|---|
| MapLibre + MapTiler Explore (map + list) | ✅ |
| Schema + RLS (`places`, saves, contributions, policies, dogs, audit) | ✅ |
| South Florida curated seed | ✅ |
| Place detail (dog-first hierarchy) | ✅ |
| Auth + private save (`user_place_saves`) | ✅ |
| `GET /api/saves` + Saved page from Supabase | ✅ |
| Create place API (`POST /api/places`) + Add flow insert | ✅ |
| Submit `policy_contributions` | ✅ |
| Server-only promote → canonical policy | ✅ |
| Auth-aware header (sign in / signed-in state) | ✅ |
| Clear Save privately vs Publish contribution UX | ✅ |
| Source + last verified on listing | ✅ |
| Sugar & Munch compatibility badges | ✅ |
| Geocoding adapter (interactive select → our places) | ✅ |
| Basic duplicate check + contribution states | ✅ |
| Mobile safe areas / touch targets / list alt | ✅ |
| RLS permission tests | ✅ |

**Out of Phase 1:** collections, follow graph, Community depth, OSM import, affiliates, full i18n pack.

**Phase 1 done when:** signed-in user can create a place, save privately without publishing, submit a contribution, promote via server RPC only, see saves in Saved, and RLS suite stays green.

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
| Evidence photos with licensing checks | ⬜ |
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
| i18n framework + EN strings | 🟡 |
| Country address formatting + service-animal copy | 🟡 |
| Seasonal policy display | ⬜ |

---

## Phase 6 — Community discovery

| Item | Status |
|---|---|
| Follow users and collections | 🟡 |
| Community tab surfaces | ✅ |
| Contribution history on profiles | ⬜ |
| No algorithmic For You feed | ✅ (by design) |

---

## Phase 7 — Data enrichment

| Item | Status |
|---|---|
| South Florida OSM import with provenance | ⬜ |
| Duplicate matching + merge tooling | 🟡 |
| Import admin | 🟡 |
| Licensed place-provider enrichment hooks | 🟡 |
| Business claim stub | 🟡 |
| Confirm MapTiler storage rights before production scale | ⬜ |

---

## Phase 8 — Monetization

| Item | Status |
|---|---|
| Affiliate links, booking CTAs, disclosure, click attribution | ✅ |
| Partner reporting | ⬜ |
| Promoted placements visually separated | ✅ |
| Confidence scoring ignores affiliate data | ✅ |

---

## Build order

1. Establish reproducible infrastructure (Phase 0) — **complete**
2. Prove the complete Dogmarked core loop (Phase 1) — **complete**
3. Harden the map experience (Phase 2) — **QA left**
4. Expand personal organization (Phase 3) — **complete**
5. Deepen trust and moderation (Phase 4) — **mostly complete** (evidence photos pending)
6. Add worldwide matching (Phase 5)
7. Grow community and imported coverage (Phases 6–7)
8. Monetize only after trust is established (Phase 8)

---

## How we use this file

- Mark items ✅ when verified in the running app (not only when scaffolding exists).
- Keep 🟡 for UI/API stubs that do not complete the user loop yet.
- Prefer updating this roadmap in the same PR/session as the feature work.
- Do not collapse personal saves into public contributions or client-write canonical policies.
