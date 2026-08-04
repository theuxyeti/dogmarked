"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PlaceLink } from "@/components/place/place-link";
import type { Collection } from "@/lib/collections";
import type { CommunityPlaceChip } from "@/lib/places/community";

/**
 * Community surfaces: shared maps, recently verified, needs verification.
 * No algorithmic For You feed.
 */
export function CommunityClient({
  collections,
  recentlyVerified,
  needsVerification,
}: {
  collections: Collection[];
  recentlyVerified: CommunityPlaceChip[];
  needsVerification: CommunityPlaceChip[];
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <p className="font-display text-3xl text-teal-deep">Dogmarked</p>
        <h1 className="mt-2 text-xl font-medium text-ink">Community</h1>
        <p className="mt-1 text-sm text-muted">
          Follow people and maps you trust — not an engagement feed.
        </p>
      </header>

      <Section id="curated" title="Shared maps" subtitle="Public collections from the community.">
        <ul className="flex flex-col gap-3">
          {collections.map((c) => (
            <li key={c.id}>
              <Link
                href={
                  c.ownerHandle
                    ? `/u/${c.ownerHandle}/${c.slug}`
                    : `/collections/${c.slug}`
                }
                className="block rounded-2xl bg-sand/40 px-4 py-4 transition hover:bg-sand/70"
              >
                <p className="font-medium text-ink">{c.title}</p>
                {c.description ? (
                  <p className="mt-1 text-sm text-muted">{c.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-teal-deep">
                  {c.ownerHandle ? `@${c.ownerHandle}` : "Community"} · {c.placeIds.length}{" "}
                  places
                </p>
              </Link>
            </li>
          ))}
          {collections.length === 0 ? (
            <li className="text-sm text-muted">
              No public collections yet. Create one and set visibility to Public.
            </li>
          ) : null}
        </ul>
      </Section>

      <Section
        id="verified"
        title="Recently verified"
        subtitle="Places with fresh community or official confirmation."
      >
        <PlaceList items={recentlyVerified} empty="No recently verified places yet." />
      </Section>

      <Section
        id="needs"
        title="Needs verification"
        subtitle="Help confirm rules before someone travels on stale info."
      >
        <PlaceList items={needsVerification} empty="Everything looks freshly verified." verify />
      </Section>
    </div>
  );
}

function PlaceList({
  items,
  empty,
  verify = false,
}: {
  items: CommunityPlaceChip[];
  empty: string;
  verify?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((p) => (
        <li key={p.slug}>
          <PlaceLink
            slug={p.slug}
            className="flex min-h-11 items-center justify-between rounded-xl px-2 py-2 hover:bg-sand/35"
            disabledClassName="flex min-h-11 items-center justify-between rounded-xl px-2 py-2 text-muted"
          >
            <span>
              <span className="font-medium text-ink">{p.name}</span>
              <span className="mt-0.5 block text-xs text-muted">{p.meta}</span>
            </span>
            {verify ? (
              <span className="text-xs font-medium text-teal-deep">Verify</span>
            ) : (
              <span className="text-muted" aria-hidden>
                →
              </span>
            )}
          </PlaceLink>
        </li>
      ))}
    </ul>
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
        className="text-sm font-semibold uppercase tracking-wide text-teal-deep"
      >
        {title}
      </h2>
      <p className="mt-1 mb-3 text-sm text-muted">{subtitle}</p>
      {children}
    </section>
  );
}
