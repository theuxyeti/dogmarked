import { mapFsqCategoryToMvp } from "@/lib/discovery/fsq-category-map";
import { ProviderHttpError } from "@/lib/discovery/errors";
import { normalizeFoursquareApiKey } from "@/lib/discovery/fsq-key";
import type {
  NearbySearchInput,
  PlaceCandidate,
  PlaceDetails,
  PlacePhoto,
  PlaceTip,
  ResolveCandidateInput,
} from "@/lib/discovery/types";
import { MAX_NEARBY_RESULTS } from "@/lib/discovery/types";
import { recordFsqUsage } from "@/lib/discovery/usage";

export { normalizeFoursquareApiKey } from "@/lib/discovery/fsq-key";

const API_BASE = "https://places-api.foursquare.com";
/** Older Places API still used by some Service Keys from the developer console. */
const LEGACY_API_BASE = "https://api.foursquare.com/v3";
const API_VERSION = "2025-06-17";
const ATTRIBUTION = "Place data © Foursquare";

/** Explicit Pro fields for lightweight nearby candidates. */
const NEARBY_FIELDS =
  "fsq_place_id,name,latitude,longitude,location,categories,distance";

const DETAILS_CORE_FIELDS =
  "fsq_place_id,name,latitude,longitude,location,categories,distance";

const DETAILS_PREMIUM_FIELDS =
  "fsq_place_id,name,latitude,longitude,location,categories,distance,tel,website,hours,description";

type FsqPlace = {
  fsq_place_id?: string;
  fsq_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  geocodes?: { main?: { latitude?: number; longitude?: number } };
  location?: {
    formatted_address?: string;
    formattedAddress?: string;
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
    country?: string;
  };
  categories?: Array<{
    fsq_category_id?: string;
    id?: number | string;
    name?: string;
  }>;
  distance?: number;
  tel?: string;
  website?: string;
  hours?: { display?: string; open_now?: boolean };
  description?: string;
};

type AuthMode = "bearer" | "raw";

function placeId(p: FsqPlace): string | null {
  const id = p.fsq_place_id ?? p.fsq_id;
  return id ? String(id) : null;
}

function coords(p: FsqPlace): { lat: number; lng: number } | null {
  const lat = p.latitude ?? p.geocodes?.main?.latitude;
  const lng = p.longitude ?? p.geocodes?.main?.longitude;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function formatAddress(loc: FsqPlace["location"] | undefined): string | undefined {
  if (!loc) return undefined;
  if (loc.formatted_address) return loc.formatted_address;
  if (loc.formattedAddress) return loc.formattedAddress;
  const parts = [loc.address, loc.locality, loc.region, loc.postcode].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function countryCode(loc: FsqPlace["location"] | undefined): string | undefined {
  const c = loc?.country?.trim();
  if (!c) return undefined;
  if (c.length === 2) return c.toUpperCase();
  // ISO-ish country names occasionally appear — leave undefined rather than slicing "Switzerland" → "SW"
  return undefined;
}

export function toCandidate(p: FsqPlace): PlaceCandidate | null {
  const id = placeId(p);
  const c = coords(p);
  if (!id || !c) return null;
  const mapped = mapFsqCategoryToMvp(
    (p.categories ?? []).map((cat) => ({
      id: cat.fsq_category_id ?? (cat.id != null ? String(cat.id) : undefined),
      name: cat.name,
    })),
  );
  const loc = p.location;
  return {
    provider: "foursquare",
    externalId: id,
    name: p.name?.trim() || "Place",
    latitude: c.lat,
    longitude: c.lng,
    distanceMeters: typeof p.distance === "number" ? p.distance : undefined,
    category: mapped.category,
    sourceCategory: mapped.sourceCategory,
    formattedAddress: formatAddress(loc),
    locality: loc?.locality,
    region: loc?.region,
    countryCode: countryCode(loc),
    phone: p.tel,
    website: p.website,
    attribution: ATTRIBUTION,
  };
}

function extractResults(data: unknown): FsqPlace[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.results)) return obj.results as FsqPlace[];
  if (Array.isArray(data)) return data as FsqPlace[];
  return [];
}

function redactSnippet(bodyText: string): string {
  return bodyText
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"');
}

/**
 * Foursquare Places API — server-only. Never import from Client Components.
 */
export class FoursquarePlaceProvider {
  constructor(private readonly apiKey: string) {}

  private headers(mode: AuthMode, includeVersion: boolean): HeadersInit {
    const headers: Record<string, string> = {
      Authorization: mode === "bearer" ? `Bearer ${this.apiKey}` : this.apiKey,
      Accept: "application/json",
    };
    if (includeVersion) {
      headers["X-Places-Api-Version"] = API_VERSION;
    }
    return headers;
  }

  private async fetchOnce(
    base: string,
    path: string,
    params: Record<string, string | number | undefined>,
    mode: AuthMode,
    includeVersion: boolean,
  ): Promise<{ ok: true; data: unknown } | { ok: false; error: ProviderHttpError }> {
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), {
      headers: this.headers(mode, includeVersion),
      cache: "no-store",
    });
    const bodyText = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        ok: false,
        error: new ProviderHttpError({
          status: res.status,
          provider: "foursquare",
          endpoint: path,
          bodySnippet: redactSnippet(bodyText),
        }),
      };
    }
    if (!bodyText) return { ok: true, data: {} };
    try {
      return { ok: true, data: JSON.parse(bodyText) as unknown };
    } catch {
      return {
        ok: false,
        error: new ProviderHttpError({
          status: 502,
          provider: "foursquare",
          endpoint: path,
          bodySnippet: "Invalid JSON response",
        }),
      };
    }
  }

  /**
   * Places API (Bearer) → Places API (raw key) → legacy v3 Places.
   * Some console keys still authenticate only on v3 or without the Bearer scheme.
   */
  private async getJson<T>(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<T> {
    const attempts: Array<{
      base: string;
      mode: AuthMode;
      includeVersion: boolean;
    }> = [
      { base: API_BASE, mode: "bearer", includeVersion: true },
      { base: API_BASE, mode: "raw", includeVersion: true },
      { base: LEGACY_API_BASE, mode: "raw", includeVersion: false },
      { base: LEGACY_API_BASE, mode: "bearer", includeVersion: false },
    ];

    let lastError: ProviderHttpError | null = null;
    for (const attempt of attempts) {
      const result = await this.fetchOnce(
        attempt.base,
        path,
        params,
        attempt.mode,
        attempt.includeVersion,
      );
      if (result.ok) return result.data as T;

      lastError = result.error;
      const status = result.error.status;
      // Only walk auth variants on unauthorized/forbidden; other errors abort.
      if (status === 401 || status === 403) continue;
      throw result.error;
    }
    throw (
      lastError ??
      new ProviderHttpError({
        status: 502,
        provider: "foursquare",
        endpoint: path,
        bodySnippet: "No response from Foursquare",
      })
    );
  }

  async nearby(input: NearbySearchInput): Promise<PlaceCandidate[]> {
    const limit = Math.min(MAX_NEARBY_RESULTS, Math.max(1, input.limit || 15));
    const baseParams = {
      ll: `${input.latitude},${input.longitude}`,
      radius: Math.round(input.radiusMeters),
      limit,
      sort: "DISTANCE" as const,
    };
    let data: unknown;
    try {
      data = await this.getJson("/places/search", {
        ...baseParams,
        fields: NEARBY_FIELDS,
      });
    } catch (err) {
      // Retry once without fields (defaults to all Pro fields) if bad request
      if (err instanceof ProviderHttpError && err.status === 400) {
        data = await this.getJson("/places/search", baseParams);
      } else {
        throw err;
      }
    }
    try {
      await recordFsqUsage("nearby");
    } catch {
      /* usage tracking must not break discovery */
    }
    return extractResults(data)
      .map(toCandidate)
      .filter((p): p is PlaceCandidate => p != null)
      .slice(0, limit);
  }

  async search(
    query: string,
    proximity?: { latitude: number; longitude: number },
    limit = 8,
  ): Promise<PlaceCandidate[]> {
    let data: unknown;
    try {
      data = await this.getJson("/places/search", {
        query: query.trim(),
        ll: proximity ? `${proximity.latitude},${proximity.longitude}` : undefined,
        radius: proximity ? 2000 : undefined,
        limit,
        sort: proximity ? "DISTANCE" : "RELEVANCE",
        fields: NEARBY_FIELDS,
      });
    } catch (err) {
      if (err instanceof ProviderHttpError && err.status === 400) {
        data = await this.getJson("/places/search", {
          query: query.trim(),
          ll: proximity ? `${proximity.latitude},${proximity.longitude}` : undefined,
          radius: proximity ? 2000 : undefined,
          limit,
          sort: proximity ? "DISTANCE" : "RELEVANCE",
        });
      } else {
        throw err;
      }
    }
    try {
      await recordFsqUsage("search");
    } catch {
      /* ignore */
    }
    return extractResults(data)
      .map(toCandidate)
      .filter((p): p is PlaceCandidate => p != null);
  }

  async resolveCandidate(
    input: ResolveCandidateInput,
  ): Promise<PlaceCandidate | null> {
    const results = await this.search(
      input.name,
      { latitude: input.latitude, longitude: input.longitude },
      5,
    );
    try {
      await recordFsqUsage("resolve");
    } catch {
      /* ignore */
    }

    const nameNorm = normalizeName(input.name);
    const addrNorm = input.address ? normalizeName(input.address) : "";

    for (const r of results) {
      const dist = haversineM(
        { lat: input.latitude, lng: input.longitude },
        { lat: r.latitude, lng: r.longitude },
      );
      if (dist > 120) continue;
      const rName = normalizeName(r.name);
      const nameClose =
        rName === nameNorm || rName.includes(nameNorm) || nameNorm.includes(rName);
      if (!nameClose) continue;
      if (addrNorm && r.formattedAddress) {
        const rAddr = normalizeName(r.formattedAddress);
        if (
          !rAddr.includes(addrNorm.slice(0, 12)) &&
          !addrNorm.includes(rAddr.slice(0, 12)) &&
          dist > 60
        ) {
          continue;
        }
      }
      return r;
    }
    return null;
  }

  async details(
    externalId: string,
    premiumFields: boolean,
  ): Promise<PlaceDetails | null> {
    const fields = premiumFields ? DETAILS_PREMIUM_FIELDS : DETAILS_CORE_FIELDS;
    let p: FsqPlace;
    try {
      p = await this.getJson<FsqPlace>(`/places/${encodeURIComponent(externalId)}`, {
        fields,
      });
    } catch (err) {
      if (
        premiumFields &&
        err instanceof ProviderHttpError &&
        (err.status === 400 || err.status === 402 || err.status === 403)
      ) {
        p = await this.getJson<FsqPlace>(`/places/${encodeURIComponent(externalId)}`, {
          fields: DETAILS_CORE_FIELDS,
        });
      } else {
        throw err;
      }
    }
    try {
      await recordFsqUsage("details");
    } catch {
      /* ignore */
    }

    const id = placeId(p);
    const c = coords(p);
    if (!id || !c) return null;
    const mapped = mapFsqCategoryToMvp(
      (p.categories ?? []).map((cat) => ({
        id: cat.fsq_category_id ?? (cat.id != null ? String(cat.id) : undefined),
        name: cat.name,
      })),
    );
    const loc = p.location;
    return {
      provider: "foursquare",
      externalId: id,
      name: p.name?.trim() || "Place",
      latitude: c.lat,
      longitude: c.lng,
      category: mapped.category,
      sourceCategory: mapped.sourceCategory,
      formattedAddress: formatAddress(loc),
      locality: loc?.locality,
      region: loc?.region,
      countryCode: countryCode(loc),
      postalCode: loc?.postcode,
      phone: premiumFields ? p.tel : undefined,
      website: premiumFields ? p.website : undefined,
      hoursSummary: premiumFields ? p.hours?.display : undefined,
      openNow: premiumFields ? (p.hours?.open_now ?? null) : null,
      description: premiumFields ? p.description : undefined,
      attribution: ATTRIBUTION,
      pricingTier: premiumFields ? "premium_fields" : "core",
    };
  }

  async photos(externalId: string, limit = 8): Promise<PlacePhoto[]> {
    const data = await this.getJson<unknown>(
      `/places/${encodeURIComponent(externalId)}/photos`,
      {
        limit: Math.min(8, Math.max(1, limit)),
        sort: "POPULAR",
      },
    );
    try {
      await recordFsqUsage("photos");
    } catch {
      /* ignore */
    }

    const list = Array.isArray(data)
      ? data
      : Array.isArray((data as { results?: unknown }).results)
        ? ((data as { results: unknown[] }).results)
        : [];

    const photos: PlacePhoto[] = [];
    list.forEach((raw, i) => {
      const ph = raw as {
        id?: string;
        prefix?: string;
        suffix?: string;
        width?: number;
        height?: number;
      };
      if (!ph.prefix || !ph.suffix) return;
      photos.push({
        id: ph.id ?? `photo-${i}`,
        url: `${ph.prefix}400x400${ph.suffix}`,
        width: ph.width,
        height: ph.height,
        attribution: ATTRIBUTION,
      });
    });
    return photos;
  }

  async tips(externalId: string, limit = 3): Promise<PlaceTip[]> {
    const data = await this.getJson<unknown>(
      `/places/${encodeURIComponent(externalId)}/tips`,
      {
        limit: Math.min(3, Math.max(1, limit)),
        sort: "POPULAR",
      },
    );
    try {
      await recordFsqUsage("tips");
    } catch {
      /* ignore */
    }

    const results = Array.isArray(data)
      ? data
      : Array.isArray((data as { results?: unknown }).results)
        ? ((data as { results: unknown[] }).results)
        : [];

    const tips: PlaceTip[] = [];
    for (const raw of results) {
      const t = raw as {
        fsq_tip_id?: string;
        id?: string;
        text?: string;
        created_at?: string;
      };
      const text = t.text?.trim();
      if (!text) continue;
      tips.push({
        id: t.fsq_tip_id ?? t.id ?? `tip-${tips.length}`,
        text,
        createdAt: t.created_at,
        attribution: ATTRIBUTION,
      });
      if (tips.length >= limit) break;
    }
    return tips;
  }
}

export function getFoursquarePlaceProvider(): FoursquarePlaceProvider | null {
  const key = normalizeFoursquareApiKey(process.env.FOURSQUARE_API_KEY ?? "");
  if (!key) return null;
  return new FoursquarePlaceProvider(key);
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
