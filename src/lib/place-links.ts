/**
 * Provider-neutral place links (official / Booking / other).
 * Affiliate monetization stays behind BOOKING_AFFILIATE_ENABLED; default isAffiliate=false.
 */

export type PlaceLinkProvider = "official" | "booking" | "foursquare" | "other";

export type PlaceLink = {
  id: string;
  placeId: string;
  provider: PlaceLinkProvider;
  url: string;
  label: string;
  externalPropertyId?: string;
  isAffiliate: boolean;
  isVerified: boolean;
  matchConfidence?: number;
  verifiedAt?: string;
};

export type PlaceLinkRow = {
  id: string;
  place_id: string;
  provider: PlaceLinkProvider;
  url: string;
  label: string;
  external_property_id: string | null;
  is_affiliate: boolean;
  is_verified: boolean;
  match_confidence: number | string | null;
  verified_at: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

function envFlag(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true" || v === "yes";
}

/** Future flags — links on by default; monetization / Demand API off. */
export function bookingFlags() {
  return {
    linksEnabled: envFlag("BOOKING_LINKS_ENABLED", true),
    affiliateEnabled: envFlag("BOOKING_AFFILIATE_ENABLED", false),
    demandApiEnabled: envFlag("BOOKING_DEMAND_API_ENABLED", false),
  };
}

export function defaultLabelForProvider(provider: PlaceLinkProvider): string {
  switch (provider) {
    case "official":
      return "Official website";
    case "booking":
      return "View on Booking.com";
    case "foursquare":
      return "View on Foursquare";
    default:
      return "External link";
  }
}

export function labelForPlaceLink(
  provider: PlaceLinkProvider,
  custom?: string | null,
): string {
  const trimmed = custom?.trim();
  if (trimmed) return trimmed;
  return defaultLabelForProvider(provider);
}

/** Same-origin hop that records a click before leaving (affiliate or not). */
export function placeLinkClickPath(linkId: string): string {
  return `/api/place-links/click?id=${encodeURIComponent(linkId)}`;
}

function normalizeHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isBookingHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "booking.com" || host.endsWith(".booking.com");
}

/**
 * Booking.com search / browse pages are never treated as verified property URLs.
 * Never fabricate these from place names.
 */
export function isBookingSearchUrl(raw: string): boolean {
  const url = normalizeHttpUrl(raw);
  if (!url || !isBookingHostname(url.hostname)) return false;

  const path = url.pathname.toLowerCase();
  if (
    path.includes("searchresults") ||
    path.startsWith("/search") ||
    path.includes("/search.") ||
    path.startsWith("/city/") ||
    path.startsWith("/region/") ||
    path.startsWith("/district/") ||
    path.startsWith("/landmark/") ||
    path.startsWith("/country/") ||
    path.startsWith("/place/") ||
    path === "/" ||
    path === "/index.html"
  ) {
    return true;
  }

  // Query-only search entry points without a property path
  if (
    !isBookingPropertyPath(path) &&
    (url.searchParams.has("ss") ||
      url.searchParams.has("ssne") ||
      url.searchParams.has("dest_id") ||
      url.searchParams.has("dest_type"))
  ) {
    return true;
  }

  return false;
}

/**
 * Normal Booking.com property listing path, e.g.
 * /hotel/fr/domaine-de-l-astragale.en-gb.html
 */
export function isBookingPropertyPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  // Accommodation type / ISO country / slug (.lang optional) .html
  return /^\/(hotel|hotels|apartment|apartments|guest-house|hostel|hostels|resort|villa|motel|bnb)\/[a-z]{2}\/[a-z0-9][a-z0-9._-]*(\.[a-z]{2}(-[a-z]{2})?)?\.html$/i.test(
    path,
  );
}

export function isBookingPropertyUrl(raw: string): boolean {
  const url = normalizeHttpUrl(raw);
  if (!url || !isBookingHostname(url.hostname)) return false;
  if (isBookingSearchUrl(raw)) return false;
  return isBookingPropertyPath(url.pathname);
}

export type BookingUrlValidation =
  | { ok: true; url: string; externalPropertyId?: string }
  | { ok: false; reason: string };

/**
 * Accept only verified-style Booking.com property URLs.
 * Rejects search pages and non-Booking hosts.
 */
export function validateBookingPropertyUrl(raw: string): BookingUrlValidation {
  const url = normalizeHttpUrl(raw);
  if (!url) {
    return { ok: false, reason: "Enter a valid https URL." };
  }
  if (!isBookingHostname(url.hostname)) {
    return { ok: false, reason: "Booking links must use booking.com." };
  }
  if (isBookingSearchUrl(raw)) {
    return {
      ok: false,
      reason: "Booking search pages are not verified property links.",
    };
  }
  if (!isBookingPropertyPath(url.pathname)) {
    return {
      ok: false,
      reason: "Use a normal Booking.com property URL (not a search page).",
    };
  }

  const slugMatch = url.pathname.match(
    /^\/(?:hotel|hotels|apartment|apartments|guest-house|hostel|hostels|resort|villa|motel|bnb)\/[a-z]{2}\/([^/?#]+)/i,
  );
  const slug = slugMatch?.[1]?.replace(/\.html$/i, "").replace(/\.[a-z]{2}(-[a-z]{2})?$/i, "");

  return {
    ok: true,
    url: url.toString(),
    externalPropertyId: slug || undefined,
  };
}

export type OfficialUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string };

export function validateOfficialUrl(raw: string): OfficialUrlValidation {
  const url = normalizeHttpUrl(raw);
  if (!url) {
    return { ok: false, reason: "Enter a valid https URL." };
  }
  if (isBookingHostname(url.hostname) && isBookingSearchUrl(raw)) {
    return {
      ok: false,
      reason: "Booking search pages cannot be saved as official links.",
    };
  }
  return { ok: true, url: url.toString() };
}

/** Whether a stored link should be shown in UI actions. */
export function isDisplayablePlaceLink(
  link: Pick<PlaceLink, "isVerified" | "url" | "provider" | "isAffiliate">,
  flags = bookingFlags(),
): boolean {
  if (!link.isVerified || !link.url) return false;
  if (link.provider === "booking") {
    if (!flags.linksEnabled) return false;
    if (!isBookingPropertyUrl(link.url)) return false;
    if (link.isAffiliate && !flags.affiliateEnabled) return false;
  }
  return true;
}

export function mapPlaceLinkRow(row: PlaceLinkRow): PlaceLink {
  const matchConfidence =
    row.match_confidence == null || row.match_confidence === ""
      ? undefined
      : Number(row.match_confidence);

  return {
    id: String(row.id),
    placeId: String(row.place_id),
    provider: row.provider,
    url: String(row.url),
    label: labelForPlaceLink(row.provider, row.label),
    externalPropertyId: row.external_property_id ?? undefined,
    isAffiliate: Boolean(row.is_affiliate),
    isVerified: Boolean(row.is_verified),
    matchConfidence: Number.isFinite(matchConfidence) ? matchConfidence : undefined,
    verifiedAt: row.verified_at ?? undefined,
  };
}

export function visiblePlaceLinks(
  links: PlaceLink[],
  flags = bookingFlags(),
): PlaceLink[] {
  return links.filter((l) => isDisplayablePlaceLink(l, flags));
}
