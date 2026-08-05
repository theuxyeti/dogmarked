import { MapPin, Search } from "lucide-react";
import { CompatibilityBadge } from "@/components/place/compatibility-badge";
import { Avatar } from "@/components/ui/avatar";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { Button } from "@/components/ui/button";
import { CategoryEmojiTile } from "@/components/ui/category-emoji-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PolicyChip } from "@/components/ui/policy-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { PLACE_CATEGORIES_UI } from "@/lib/mvp/taxonomy";

export const metadata = { title: "Design system" };

const COLOR_TOKENS = [
  ["--color-brand", "Brand"],
  ["--color-brand-hover", "Brand hover"],
  ["--color-brand-soft", "Brand soft"],
  ["--color-action", "Action (coral)"],
  ["--color-action-soft", "Action soft"],
  ["--color-highlight", "Highlight"],
  ["--color-canvas", "Canvas"],
  ["--color-surface", "Surface"],
  ["--color-surface-raised", "Surface raised"],
  ["--color-surface-muted", "Surface muted"],
  ["--color-ink", "Ink"],
  ["--color-ink-muted", "Ink muted"],
  ["--color-border", "Border"],
  ["--color-border-strong", "Border strong"],
];

const POLICY_TOKENS = [
  ["--policy-confirmed", "Confirmed"],
  ["--policy-restricted", "Restricted"],
  ["--policy-community", "Community"],
  ["--policy-unknown", "Unknown"],
  ["--policy-not-allowed", "Not allowed"],
];

const MARKER_SHELLS = [
  ["confirmed", "Confirmed", "🏨"],
  ["restricted", "Restricted", "🍽️"],
  ["community", "Community", "🌲"],
  ["unknown", "Unknown", "☕"],
  ["not-allowed", "Not allowed", "🏖️"],
] as const;

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 py-10 pb-28">
      <header className="space-y-2">
        <p className="text-[length:var(--text-overline)] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
          Phase 6A
        </p>
        <h1 className="font-display text-[length:var(--text-display)] text-[var(--color-brand-hover)]">
          Design system
        </h1>
        <p className="max-w-xl text-[var(--color-ink-muted)]">
          Modern Travel Field Guide tokens and primitives. Map-first, warm, policy-colored —
          coral for create/contribute only.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-[length:var(--text-page-title)] text-ink">Color</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {COLOR_TOKENS.map(([token, label]) => (
            <li
              key={token}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
            >
              <span
                className="h-8 w-8 shrink-0 rounded-md border border-[var(--color-border)]"
                style={{ background: `var(${token})` }}
              />
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="font-mono text-xs text-[var(--color-ink-muted)]">{token}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[length:var(--text-page-title)] text-ink">
          Policy status
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {POLICY_TOKENS.map(([token, label]) => (
            <li
              key={token}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
            >
              <span
                className="h-8 w-8 shrink-0 rounded-md border border-[var(--color-border)]"
                style={{ background: `var(${token})` }}
              />
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="font-mono text-xs text-[var(--color-ink-muted)]">{token}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <StatusBadge status="confirmed" />
          <StatusBadge status="restricted" />
          <StatusBadge status="community" />
          <StatusBadge status="unknown" />
          <StatusBadge status="not-allowed" />
        </div>
        <div className="flex flex-wrap gap-2">
          <PolicyChip tone="confirmed">Dogs welcome</PolicyChip>
          <PolicyChip tone="restricted">Outdoor only</PolicyChip>
          <PolicyChip tone="community">Traveler confirmed</PolicyChip>
          <PolicyChip tone="unknown">Policy unknown</PolicyChip>
          <PolicyChip tone="not-allowed">Not allowed</PolicyChip>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[length:var(--text-page-title)] text-ink">
          Marker shells
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          {MARKER_SHELLS.map(([cls, label, emoji]) => (
            <div key={cls} className="flex flex-col items-center gap-2">
              <button
                type="button"
                className={`dm-marker dm-marker--${cls}`}
                aria-label={`${label}, dog policy ${cls.replace("-", " ")}`}
                data-selected={cls === "confirmed" ? "true" : undefined}
              >
                <span className="dm-marker-emoji" aria-hidden>
                  {emoji}
                </span>
              </button>
              <span className="text-xs text-[var(--color-ink-muted)]">{label}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            <button type="button" className="dm-marker dm-marker--temp" aria-label="Temp pin">
              +
            </button>
            <span className="text-xs text-[var(--color-ink-muted)]">Temp (coral)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              className="dm-marker dm-marker--cluster"
              aria-label="3 places"
            >
              3
            </button>
            <span className="text-xs text-[var(--color-ink-muted)]">Cluster</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="dm-poi-marker" title="Neutral POI" />
            <span className="text-xs text-[var(--color-ink-muted)]">Neutral POI</span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[length:var(--text-page-title)] text-ink">
          Category tiles
        </h2>
        <div className="flex flex-wrap gap-2">
          {PLACE_CATEGORIES_UI.map((c) => (
            <CategoryEmojiTile key={c.id} category={c.id} size="md" />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[length:var(--text-page-title)] text-ink">
          Components
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="action">Contribute</Button>
          <IconButton aria-label="Search" variant="outline">
            <Search className="h-4 w-4" />
          </IconButton>
          <IconButton aria-label="Locate" variant="soft">
            <MapPin className="h-4 w-4" />
          </IconButton>
          <Badge>Badge</Badge>
          <CompatibilityBadge verdict="good_match" />
          <CompatibilityBadge verdict="ask_first" />
          <CompatibilityBadge verdict="not_a_match" />
          <CompatibilityBadge verdict="unknown" />
        </div>
        <Input placeholder="Input" className="max-w-sm" />
        <div className="flex items-center gap-3 pt-2">
          <Avatar fallback="ZS" />
          <AvatarStack
            label="Exploring with Sugar & Munch"
            items={[
              { id: "1", fallback: "S", alt: "Sugar" },
              { id: "2", fallback: "M", alt: "Munch" },
            ]}
          />
        </div>
        <div className="grid max-w-sm gap-2 pt-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <EmptyState
            category="park"
            title="No nearby places yet"
            description="Try a larger radius, or drop a pin to add a custom place."
            action={<Button size="sm">Add a place</Button>}
          />
        </div>
      </section>

      <section className="space-y-2 text-sm text-[var(--color-ink-muted)]">
        <h2 className="font-display text-[length:var(--text-page-title)] text-ink">
          Spacing & radius
        </h2>
        <p>
          Scale <code className="text-ink">--space-1</code>…<code className="text-ink">--space-12</code>{" "}
          (4–48px). Radius: 8 / 12 / 16 / 20–24; pills only for compact filters.
        </p>
        <p>
          Focus ring: <code className="text-ink">--focus-ring</code>. Elevation:{" "}
          <code className="text-ink">--elevation-1</code>…<code className="text-ink">3</code>.
        </p>
      </section>
    </div>
  );
}
