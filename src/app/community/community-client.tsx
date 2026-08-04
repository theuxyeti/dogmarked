"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface CuratedMap {
  handle: string;
  slug: string;
  title: string;
  blurb: string;
}

interface PlaceChip {
  slug: string;
  name: string;
  meta: string;
}

const CURATED_MAPS: CuratedMap[] = [
  {
    handle: "zach",
    slug: "south-florida-with-dogs",
    title: "South Florida with dogs",
    blurb: "Beaches, shade parks, and patio lunches from Miami to Palm Beach.",
  },
  {
    handle: "dogmarked",
    slug: "fort-lauderdale-patios",
    title: "Fort Lauderdale patios",
    blurb: "Waterfront spots where leash manners matter.",
  },
];

const RECENTLY_VERIFIED: PlaceChip[] = [
  {
    slug: "hale-patisserie-coral-gables",
    name: "Hale Pâtisserie",
    meta: "Verified Jul 2026 · patio",
  },
  {
    slug: "hollywood-park-miami-beach",
    name: "Haulover Park",
    meta: "Verified Jun 2026 · outdoors",
  },
];

const NEEDS_VERIFICATION: PlaceChip[] = [
  {
    slug: "unknown-cafe-wynwood",
    name: "Wynwood corner café",
    meta: "OSM import · single report",
  },
  {
    slug: "delray-beach-boardwalk",
    name: "Delray boardwalk stretch",
    meta: "Last verified > 12 months",
  },
];

/**
 * Community surfaces: curated maps, recently verified, needs verification.
 * Fixture data for Phase 6 — no algorithmic For You feed.
 */
export function CommunityClient() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink,#1c2421)]">
          Dogmarked
        </p>
        <h1 className="mt-2 text-xl font-medium">Community</h1>
        <p className="mt-1 text-sm text-[var(--ink,#1c2421)]/65">
          Follow people and maps you trust — not an engagement feed.
        </p>
      </header>

      <Section
        id="curated"
        title="Curated maps"
        subtitle="Shared collections worth following."
      >
        <ul className="flex flex-col gap-3">
          {CURATED_MAPS.map((m) => (
            <li key={`${m.handle}-${m.slug}`}>
              <Link
                href={`/u/${m.handle}/${m.slug}`}
                className="block rounded-2xl bg-[var(--sand,#e8dfd2)]/40 px-4 py-4 transition hover:bg-[var(--sand,#e8dfd2)]/70"
              >
                <p className="font-medium text-[var(--ink,#1c2421)]">{m.title}</p>
                <p className="mt-1 text-sm text-[var(--ink,#1c2421)]/65">{m.blurb}</p>
                <p className="mt-2 text-xs text-[var(--teal,#0f5c56)]">
                  @{m.handle}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="verified"
        title="Recently verified"
        subtitle="Places with fresh community or official confirmation."
      >
        <ul className="flex flex-col gap-2">
          {RECENTLY_VERIFIED.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/place/${p.slug}`}
                className="flex min-h-11 items-center justify-between rounded-xl px-2 py-2 hover:bg-[var(--sand,#e8dfd2)]/35"
              >
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--ink,#1c2421)]/55">
                    {p.meta}
                  </span>
                </span>
                <span className="text-[var(--ink,#1c2421)]/35" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="needs"
        title="Needs verification"
        subtitle="Help confirm rules before someone travels on stale info."
      >
        <ul className="flex flex-col gap-2">
          {NEEDS_VERIFICATION.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/place/${p.slug}`}
                className="flex min-h-11 items-center justify-between rounded-xl px-2 py-2 hover:bg-[var(--sand,#e8dfd2)]/35"
              >
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--ink,#1c2421)]/55">
                    {p.meta}
                  </span>
                </span>
                <span className="text-xs font-medium text-[var(--teal,#0f5c56)]">
                  Verify
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`community-${id}`} className="mb-10">
      <h2
        id={`community-${id}`}
        className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]"
      >
        {title}
      </h2>
      <p className="mt-1 mb-3 text-sm text-[var(--ink,#1c2421)]/60">{subtitle}</p>
      {children}
    </section>
  );
}
