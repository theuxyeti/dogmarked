# Dogmarked design system

Trustworthy, exploratory, warm travel product — not cartoon pets, paw spam, or purple SaaS.

## Typography

- **Family:** Manrope (`--font-manrope` → `--font-sans` / `--font-display`)
- Display weight ~650; body regular. Avoid default Inter/Roboto/Arial stacks.

## Tokens (`src/app/globals.css`)

| Token | Role |
|---|---|
| `--dm-teal` / `--dm-teal-deep` | Brand primary / deep |
| `--dm-sand` / `--dm-paper` / `--dm-foam` | Warm surfaces |
| `--dm-ink` / `--dm-muted` | Text |
| `--dm-good` / `--dm-ask` / `--dm-danger` | Policy / compatibility status |
| `--dm-neutral-poi` | Contextual basemap POIs (never “dog friendly”) |
| `--dm-policy-pin` | Dogmarked pins with evidence |
| `--dm-panel-left` / `--dm-panel-right` | Explore chrome widths |
| `--dm-header-h` | Desktop header (64px) |

Legacy aliases (`--teal`, `--ink`, …) remain for existing components.

## Map layers

1. **A — Basemap** MapTiler streets (POI labels from style)
2. **B — Neutral contextual POIs** quiet markers; selecting does not imply dog policy
3. **C — Dogmarked pins** stronger, status-colored only when canonical policy exists

## Shared place content

Use `PlaceDetail` / `PlaceLink` — do not duplicate place hierarchies across panel, sheet, and page.

## Showcase

`/design-system` — token and component reference for QA.
