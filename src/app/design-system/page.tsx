import { CompatibilityBadge } from "@/components/place/compatibility-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Design system" };

const TOKENS = [
  ["--dm-teal", "Brand"],
  ["--dm-teal-deep", "Brand deep"],
  ["--dm-sand", "Warm surface"],
  ["--dm-paper", "Page"],
  ["--dm-foam", "Soft fill"],
  ["--dm-ink", "Text"],
  ["--dm-muted", "Secondary text"],
  ["--dm-good", "Policy welcome"],
  ["--dm-ask", "Ask first"],
  ["--dm-danger", "Not allowed"],
  ["--dm-neutral-poi", "Contextual POI"],
];

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 pb-28">
      <header className="space-y-2">
        <h1 className="font-display text-4xl text-teal-deep">Design system</h1>
        <p className="text-muted">
          Manrope + coastal travel tokens. Neutral map POIs never imply dog-friendly.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-ink">Tokens</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TOKENS.map(([token, label]) => (
            <li
              key={token}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <span
                className="h-8 w-8 shrink-0 rounded-md border border-border"
                style={{ background: `var(${token})` }}
              />
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="font-mono text-xs text-muted">{token}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-ink">Components</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Badge>Badge</Badge>
          <CompatibilityBadge verdict="good_match" />
          <CompatibilityBadge verdict="ask_first" />
          <CompatibilityBadge verdict="not_a_match" />
          <CompatibilityBadge verdict="unknown" />
        </div>
        <Input placeholder="Input" className="max-w-sm" />
        <div className="flex items-center gap-4 pt-2">
          <span className="dm-poi-marker" title="Neutral POI" />
          <span className="text-sm text-muted">Neutral contextual POI</span>
          <span className="dm-policy-marker" data-status="dogs_welcome" />
          <span className="text-sm text-muted">Dogmarked policy pin</span>
        </div>
      </section>
    </div>
  );
}
