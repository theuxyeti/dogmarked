/**
 * Affiliate / booking links — monetization must never touch policy confidence.
 */

export interface AffiliateLink {
  id: string;
  placeId: string;
  label: string;
  /** Full tracking URL including partner params */
  url: string;
  network: string | null;
  disclosed: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const AFFILIATE_DISCLOSURE =
  "This booking link may earn Dogmarked a commission. It never changes policy confidence or match scoring.";

export interface ConfidenceInput {
  /** Existing confidence score or enum — opaque to affiliates */
  confidence: unknown;
}

/**
 * Hard guard: affiliate presence must not mutate confidence payloads.
 * Call before persisting policy updates when affiliate context is nearby.
 */
export function assertConfidenceUntouched<T extends ConfidenceInput>(
  before: T,
  after: T,
): T {
  if (JSON.stringify(before.confidence) !== JSON.stringify(after.confidence)) {
    throw new Error(
      "Affiliate flow attempted to change policy confidence — blocked.",
    );
  }
  return after;
}

export function withAffiliateDisclosure(link: AffiliateLink | null | undefined): {
  link: AffiliateLink | null;
  disclosure: string;
  enabled: boolean;
} {
  if (!link || !link.isActive || !link.url) {
    return { link: null, disclosure: AFFILIATE_DISCLOSURE, enabled: false };
  }
  return {
    link: { ...link, disclosed: true },
    disclosure: AFFILIATE_DISCLOSURE,
    enabled: true,
  };
}

/** Same-origin hop that records attribution before leaving to the partner. */
export function affiliateClickPath(linkId: string): string {
  return `/api/affiliates/click?id=${encodeURIComponent(linkId)}`;
}
