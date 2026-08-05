# Dogmarked design system

**North star:** Modern Travel Field Guide for people and their dogs — warm, editorial, map-first, premium but approachable. Not a generic SaaS dashboard, pet-store cartoon, or database UI.

Active plan: Cursor **Dogmarked Pet-First Map and Visual Experience** (`smart_nearby_discovery_ae063e17`) — Phase **6A** tokens and primitives are landed in `src/app/globals.css` + `/design-system` before markers (7) and place card 2.0 (9).

Showcase route: `/design-system`

---

## Brand direction

| Be | Avoid |
|---|---|
| Map-first, calm, travel-oriented | Dashboard chrome, dense filter bars |
| Warm canvas supporting the map | Large empty beige voids |
| Quietly playful pet identity | Dog puns, paw spam, childish styling |
| Distinctive dog-policy verdict | Generic alert boxes for status |
| Travel-journal trip reports | Chat bubbles / heavy bordered cards |
| Restrained coral for create/contribute | Coral meaning “dog-friendly” |
| Teal as brand (not everywhere) | Overuse of teal |

**Personality:** curious, trustworthy, warm, well traveled, pet knowledgeable, community informed, quietly playful.

**Copy examples (good):** Exploring with Sugar & Munch · Can Sugar and Munch go here? · Dog policy not documented yet · Four travelers recently confirmed this.

---

## Visual hierarchy

1. Map and location  
2. Selected place  
3. Dog access verdict  
4. Active pet/pack compatibility  
5. Important restrictions  
6. Save / contribution actions  
7. Community evidence  
8. Provider attribution  

---

## Color tokens (Phase 6A — landed)

Defined in `src/app/globals.css`. Validate WCAG contrast in features; extend `--color-*` / `--dm-*` / `--policy-*`; do not hardcode in features.

| Token | Role |
|---|---|
| `--color-ink` / `--color-ink-muted` | Text |
| `--color-canvas` / `--color-surface` / `--color-surface-raised` / `--color-surface-muted` | Warm surfaces |
| `--color-border` / `--color-border-strong` | Borders |
| `--color-brand` / hover / soft | Teal brand |
| `--color-action` / hover / soft | Coral create/contribute |
| `--color-highlight` / soft | Accent highlight |
| `--policy-confirmed` (+ soft) | Confirmed dog-friendly |
| `--policy-restricted` (+ soft) | Restrictions / ask first / fees |
| `--policy-community` (+ soft) | Community-reported |
| `--policy-unknown` (+ soft) | Unknown |
| `--policy-not-allowed` (+ soft) | Recently not allowed |
| `--focus-ring` | Keyboard focus |

**Rules:** color never sole status indicator; red = negative/destructive only; coral ≠ dog-friendly.

Legacy aliases (`--dm-teal`, `--teal`, `--ink`, …) remain until migrated.

---

## Typography

- **Product:** Manrope (`--font-manrope` → `--font-sans`) — nav, controls, forms, chips, metadata, reports.
- **Editorial display (optional):** one restrained face (e.g. Fraunces) for destination/place titles and empty-state headlines only — never dense UI or small text. Skip unless load cost is justified.

**Scale tokens (landed):** `--text-display` · `--text-page-title` · `--text-place-title` · `--text-section` · `--text-body` · `--text-body-sm` · `--text-label` · `--text-caption` · `--text-overline`.

---

## Spacing, radius, elevation

4px scale: `--space-1` (4px) … `--space-12` (48px).

| Radius | Use |
|---|---|
| 8px | Small controls, thumbnails |
| 12px | Cards, inputs |
| 16px | Content panels |
| 20–24px | Drawers, mobile sheets |
| Full pill | Filters, segmented controls, compact chips only |

Elevation tokens sparingly: map controls, selected marker, drawer/sheet. Cards: border + surface contrast, not thick shadows.

---

## Iconography and emoji

- **UI icons:** one family (Lucide) — search, close, directions, website, phone, share, edit, visibility, account, map controls.
- **Emoji:** place categories + occasional pet personality only, via controlled component (size, alignment, background, accessible label).

---

## Marker anatomy (Phase 7 on 6A shells)

- Branded circular/pin shell  
- Category emoji centered  
- Shell color = dog-policy status token  
- Selected: larger + ring  
- Hover / keyboard focus  
- Cluster at low zoom  
- Accessible label: “Hotel, dog policy unknown”  
- Coral reserved for temporary drop pins / creation  

---

## Policy-chip anatomy

Group by meaning: Access · Size and count · Areas · Rules and fees. Show top 4–6, then “View full policy”. Color roles match policy tokens; never a single undifferentiated badge wall.

---

## Place-card anatomy (Phase 9)

Compact destination guide:

1. **Hero** — ~16:9, swipe/pagination, attribution, category artwork fallback (never empty “Photo coming soon”)  
2. **Identity** — category overline, strong name, address/distance, compact actions, saved state  
3. **Verdict** — distinctive block (not an error alert) + evidence lines  
4. **Pack compatibility** — avatars + cautious language  
5. **Policy chips** — grouped  
6. **My entry**  
7. **Trip reports** — journal feed, whitespace/dividers  
8. **Sticky actions** — Save → Trip report → Directions → Website/Booking (unequal weight)

**Desktop drawer:** ~420–480px; map remains usable.  
**Mobile sheet:** collapsed / half / full; safe-area sticky actions; map context preserved.

---

## Map chrome

Compact floating search; restrained layer control; subtle search radius; smooth camera; controls must not compete with the map. Optional warmer MapTiler style — not a blocker.

---

## Motion

Marker select 150–200ms · drawer 200–280ms · sheet spring + reduced-motion fallback · photo fade · chip immediate · calm save feedback · pet-switch crossfade. No list-load animation spam. Honor `prefers-reduced-motion`.

---

## Empty states

Intentional category artwork (soft gradient + controlled emoji + optional contour). One clear next action for: no reports, no nearby, no saves, no pets, no official policy, media unavailable.

---

## Responsive

| Context | Requirement |
|---|---|
| Wide desktop | Map fills viewport; lists have deliberate max-width; density at 1280/1440 |
| Mobile 375 / 390 / 430 | No horizontal scroll; 44px targets; sheet keeps map context |
| Zoom 200% | Remains usable |

---

## Accessibility

WCAG AA where applicable: text/focus contrast, keyboard, color-independent policy meaning, marker labels, sheet/drawer semantics, reduced motion, screen-reader action labels, touch targets.

---

## Correct vs incorrect

| Correct | Incorrect |
|---|---|
| Travel-guide place card with strong verdict | Dense form-like place “record” |
| Gray unknown marker | Green marker because Foursquare returned a hotel |
| Journal-style trip report | Chat thread or star ratings |
| Category artwork fallback | “Photo coming soon” rectangle |
| Coral Add / pin | Coral shell meaning dog-friendly |
| Few pill chips for filters | Every button and card fully pill-shaped |
| Explore loop polished first | Restyle every secondary page first |

---

## Map layers (foundation)

1. **A — Basemap** MapTiler (optional warmer style later)  
2. **B — Neutral contextual POIs** never imply dog policy  
3. **C — Dogmarked markers** policy-colored only with Dogmarked evidence  

---

## Shared place content

Use shared place-card / PlaceLink primitives — do not fork hierarchies across panel, sheet, and page.

## Primitives (Phase 6A)

Under `src/components/ui/`: Button (+ `action` coral variant), IconButton, Input, Badge, PolicyChip, StatusBadge, Avatar, AvatarStack, Skeleton, EmptyState, CategoryEmojiTile. Marker policy shells: `.dm-marker--confirmed|restricted|community|unknown|not-allowed`; coral `.dm-marker--temp` for create pins only.

## Category taxonomy

UI categories include restaurant / cafe / bar (FSQ maps accordingly). `food_drink` remains API back-compat → DB `restaurant`. Bar persists as `restaurant` until a DB enum exists.

## Implementation note

Phase 6A is landed. Apply the visual system Explore-first (header → search → map → markers → nearby → drawer/sheet). Do not broadly restyle secondary pages before the Explore loop is complete.
