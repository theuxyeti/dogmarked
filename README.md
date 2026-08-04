# Dogmarked

Build your own map of dog-friendly places, discover places shared by others, and understand the actual rules before you arrive.

Map-first travel web app: personal saves, public policy contributions, and a trusted canonical dog-policy database. Phase 0–1 ships infrastructure plus a South Florida vertical slice.

**Tracking:** [`docs/roadmap.md`](docs/roadmap.md) (phase status) · [`docs/master-build-plan.md`](docs/master-build-plan.md) (architecture)

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS v4
- **MapLibre GL** + **MapTiler** (tiles + geocoding adapter)
- **Supabase** (Auth, Postgres + PostGIS, RLS)
- **Vercel** (hosting)

## Setup

```bash
npm install
cp .env.example .env.local
# Fill env values after creating Supabase + MapTiler projects (never commit secrets)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/explore`.

## Environment variables

Names only (see `.env.example`):

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + server | Publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Admin / privileged ops — never expose to the browser |
| `NEXT_PUBLIC_MAPTILER_KEY` | Client + server | Map tiles + interactive geocoding |
| `NEXT_PUBLIC_APP_URL` | App | Canonical public URL (local / preview / production) |

Without Supabase keys, Explore uses curated South Florida fixtures. Without a MapTiler key, the map uses MapLibre demotiles and geocoding falls back to fixtures.

## Phase 0 checkpoints (user-controlled)

Cursor scaffolds code but cannot invent accounts or credentials. Complete these before relying on deployed backends:

1. **GitHub** — create/authorize the repo; push only after confirmation
2. **Vercel** — connect the repo; configure Development / Preview / Production env slots
3. **Supabase** — create project; paste URL + publishable key into Vercel / `.env.local`; keep service role server-only
4. **MapTiler** — create public key for `NEXT_PUBLIC_MAPTILER_KEY`
5. **Auth redirects** in Supabase allow-list:
   - `http://localhost:3000/auth/callback`
   - Wildcard Vercel preview callback
   - Exact production callback when domain is ready

**Rules:** Never commit `.env.local`, API secrets, or service-role keys. Never fabricate credentials.

## Local Supabase / migrations

```bash
# Requires Supabase CLI
supabase start
supabase db reset   # applies migrations + seed.sql
```

Migrations live in `supabase/migrations/`:

- PostGIS enablement
- Core schema (`places`, `user_place_saves`, `policy_contributions`, `dog_policies`, …)
- RLS + `promote_policy_contribution` SECURITY DEFINER RPC

Seed bootstraps curated South Florida places with canonical policies for local demos. In production, clients submit `policy_contributions` only; canonical rows are written via the promote RPC (server-side).

Generate types (optional):

```bash
npm run db:types
```

## Useful routes

| Route | Purpose |
|---|---|
| `/explore` | Map + list + place detail |
| `/saved` | Personal saves stub |
| `/add` | Add place + contribution form |
| `/community` | Phase 1 curated message |
| `/profile` | Sugar & Munch dog profiles |
| `/place/[slug]` | Shareable place page |
| `/u/[handle]` | Public profile shell (Phase 3) |
| `/login` | Magic-link auth |
| `/auth/callback` | Code exchange + safe return path |
| `/api/health` | `{ ok, supabase, maptiler }` |

## Scripts

```bash
npm run dev       # local app
npm run build     # production build
npm run lint
npm test          # vitest
```

## Geocoding note

MapTiler results are for **interactive selection**. Before production, verify the plan permits permanent storage of each field you retain. Provider feature IDs are not stable permanent foreign keys. The provider is behind `src/lib/geocoding` so it can be swapped.

## Product foundation (do not collapse)

Location → personal save → public contribution → trusted canonical policy

Private saves never publish. Canonical `dog_policies` / `dog_policy_versions` are writable only via protected server promotion.
