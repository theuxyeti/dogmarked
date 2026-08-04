"use client";

import {
  AFFILIATE_DISCLOSURE,
  type AffiliateLink,
  withAffiliateDisclosure,
} from "@/lib/affiliates";

export interface BookingCtaProps {
  link?: AffiliateLink | null;
  placeName?: string;
  className?: string;
}

/**
 * Disclosed affiliate booking CTA.
 * Disabled (and non-navigating) unless an active link is present.
 */
export function BookingCta({ link, placeName, className }: BookingCtaProps) {
  const { enabled, disclosure } = withAffiliateDisclosure(link);

  return (
    <div
      className={[
        "rounded-2xl border border-border/60 bg-sand/35 px-4 py-4",
        // Visually separated from policy confidence / match scoring
        "ring-1 ring-inset ring-teal/10",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Booking · partner link
      </p>
      {enabled && link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--teal,#0f5c56)] px-5 text-sm font-medium text-white"
        >
          {link.label || "Check availability"}
          {placeName ? ` · ${placeName}` : ""}
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="mt-3 inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-full bg-[var(--ink,#1c2421)]/15 px-5 text-sm font-medium text-[var(--ink,#1c2421)]/45"
        >
          Check availability
        </button>
      )}
      <p className="mt-3 text-xs leading-relaxed text-[var(--ink,#1c2421)]/55">
        {disclosure || AFFILIATE_DISCLOSURE}
      </p>
    </div>
  );
}
