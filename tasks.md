<tldr>
Code for Phases 1–8 is in and builds; [`docs/master-build-plan.md`](docs/master-build-plan.md) checklists updated. **Phase 0 blocked on your checkpoints** — need GitHub, Vercel, Supabase, and MapTiler before preview deploy.
</tldr>

## Active

- [ ] Phase 0 checkpoints — waiting on you (see questions below)

## Blocked

- [ ] GitHub repository URL or OK to create `dogmarked`
- [ ] Vercel team/project connection
- [ ] Supabase project URL + publishable key + service-role key (prefer `.env.local`, not chat)
- [ ] MapTiler public API key
- [ ] Production domain (optional for now)

## Done

- [x] [`docs/master-build-plan.md`](docs/master-build-plan.md) — living checklists
- [x] Phase 1 vertical slice — [UI agent](3596cef8-29a2-4919-8722-131db631de8b) + [schema agent](fcf0e1b0-8b31-40c5-9bf7-cc2937a845b2)
- [x] Phases 2–8 modules — [features agent](294c0a8a-3e95-4a68-ab80-5684e723884b)
- [x] `npm test` (11) + `npm run build` green
