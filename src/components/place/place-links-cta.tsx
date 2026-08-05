"use client";

import { ExternalLink } from "lucide-react";
import {
  bookingFlags,
  defaultLabelForProvider,
  placeLinkClickPath,
  visiblePlaceLinks,
  type PlaceLink,
} from "@/lib/place-links";
import { AFFILIATE_DISCLOSURE } from "@/lib/affiliates";
import { cn } from "@/lib/utils";

export interface PlaceLinksCtaProps {
  links?: PlaceLink[] | null;
  /** Discovery / place.website fallback when no verified official place_link exists */
  fallbackOfficialUrl?: string | null;
  placeName?: string;
  className?: string;
}

/**
 * Provider-neutral place actions: Official website + verified Booking.com only.
 * No partner / affiliate copy when isAffiliate=false. Hidden when nothing verified.
 */
export function PlaceLinksCta({
  links,
  fallbackOfficialUrl,
  placeName,
  className,
}: PlaceLinksCtaProps) {
  const flags = bookingFlags();
  const verified = visiblePlaceLinks(links ?? [], flags);

  const official =
    verified.find((l) => l.provider === "official") ??
    (fallbackOfficialUrl?.trim()
      ? ({
          id: "",
          placeId: "",
          provider: "official" as const,
          url: fallbackOfficialUrl.trim(),
          label: defaultLabelForProvider("official"),
          isAffiliate: false,
          isVerified: true,
        } satisfies PlaceLink)
      : null);

  const booking = flags.linksEnabled
    ? verified.find((l) => l.provider === "booking") ?? null
    : null;

  const actions = [official, booking].filter(Boolean) as PlaceLink[];
  if (actions.length === 0) return null;

  const anyAffiliate = actions.some((l) => l.isAffiliate);
  const showAffiliateCopy = anyAffiliate && flags.affiliateEnabled;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-4 py-4",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {showAffiliateCopy ? "Booking · partner link" : "Links"}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {actions.map((link) => {
          const href = link.id ? placeLinkClickPath(link.id) : link.url;
          const rel = link.isAffiliate
            ? "noopener noreferrer sponsored"
            : "noopener noreferrer";
          const label = link.label || defaultLabelForProvider(link.provider);
          return (
            <a
              key={`${link.provider}-${link.id || link.url}`}
              href={href}
              target="_blank"
              rel={rel}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-600,#0f5c56)] px-5 text-sm font-medium text-white"
            >
              {label}
              {placeName && link.provider === "booking" ? ` · ${placeName}` : ""}
              <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </a>
          );
        })}
      </div>
      {showAffiliateCopy ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
          {AFFILIATE_DISCLOSURE}
        </p>
      ) : null}
    </div>
  );
}
