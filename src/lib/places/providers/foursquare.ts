import { mapFsqCategoryToMvp } from "@/lib/discovery/fsq-category-map";
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

const API_BASE = "https://places-api.foursquare.com";
const API_VERSION = "2025-06-17";
const ATTRIBUTION = "Place data © Foursquare";

type FsqPlace = {
  fsq_place_id?: string;
  fsq_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  geocodes?: { main?: { latitude?: number; longitude?: number } };
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
    country?: string;
  };
  categories?: Array<{ fsq_category_id?: string; name?: string }>;
  distance?: number;
  tel?: string;
  website?: string;
  hours?: { display?: string; open_now?: boolean };
  description?: string;
};

function placeId(p: FsqPlace): string | null {
  return p.fsq_place_id ?? p.fsq_id ?? null;
}

function coords(p: FsqPlace): { lat: number; lng: number } | null {
  const lat = p.latitude ?? p.geocodes?.main?.latitude;
  const lng = p.longitude ?? p.geocodes?.main?.longitude;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function toCandidate(p: FsqPlace): PlaceCandidate | null {
  const id = placeId(p);
  const c = coords(p);
  if (!id || !c) return null;
  const mapped = mapFsqCategoryToMvp(p.categories);
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
    formattedAddress: loc?.formatted_address ?? loc?.address,
    locality: loc?.locality,
    region: loc?.region,
    countryCode: loc?.country?.slice(0, 2)?.toUpperCase(),
    phone: p.tel,
    website: p.website,
    attribution: ATTRIBUTION,
  };
}

/**
 * Foursquare Places API — server-only. Never import from client components.
 */
export class FoursquarePlaceProvider {
  constructor(private readonly apiKey: string) {}

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "X-Places-Api-Version": API_VERSION,
    };
  }

  private async getJson<T>(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${API_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), {
      headers: this.headers(),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Foursquare ${path} failed (${res.status}): ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  async nearby(input: NearbySearchInput): Promise<PlaceCandidate[]> {
    const limit = Math.min(MAX_NEARBY_RESULTS, Math.max(1, input.limit || 15));
    const data = await this.getJson<{ results?: FsqPlace[] }>("/places/search", {
      ll: `${input.latitude},${input.longitude}`,
      radius: Math.round(input.radiusMeters),
      limit,
      sort: "DISTANCE",
      fields:
        "fsq_place_id,name,latitude,longitude,location,categories,distance",
    });
    await recordFsqUsage("nearby");
    return (data.results ?? [])
      .map(toCandidate)
      .filter((p): p is PlaceCandidate => p != null)
      .slice(0, limit);
  }

  async search(
    query: string,
    proximity?: { latitude: number; longitude: number },
    limit = 8,
  ): Promise<PlaceCandidate[]> {
    const data = await this.getJson<{ results?: FsqPlace[] }>("/places/search", {
      query: query.trim(),
      ll: proximity ? `${proximity.latitude},${proximity.longitude}` : undefined,
      limit,
      sort: proximity ? "DISTANCE" : "RELEVANCE",
      fields: "fsq_place_id,name,latitude,longitude,location,categories,distance",
    });
    await recordFsqUsage("search");
    return (data.results ?? [])
      .map(toCandidate)
      .filter((p): p is PlaceCandidate => p != null);
  }

  async resolveCandidate(
    input: ResolveCandidateInput,
  ): Promise<PlaceCandidate | null> {
    const results = await this.search(input.name, {
      latitude: input.latitude,
      longitude: input.longitude,
    }, 5);
    // search already recorded; also count as resolve for clarity if needed
    await recordFsqUsage("resolve");

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
        rName === nameNorm ||
        rName.includes(nameNorm) ||
        nameNorm.includes(rName);
      if (!nameClose) continue;
      if (addrNorm && r.formattedAddress) {
        const rAddr = normalizeName(r.formattedAddress);
        if (!rAddr.includes(addrNorm.slice(0, 12)) && !addrNorm.includes(rAddr.slice(0, 12))) {
          // soft address check — still allow strong name+distance match under 60m
          if (dist > 60) continue;
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
    const fields = premiumFields
      ? "fsq_place_id,name,latitude,longitude,location,categories,tel,website,hours,description,distance"
      : "fsq_place_id,name,latitude,longitude,location,categories,distance";

    const p = await this.getJson<FsqPlace>(`/places/${encodeURIComponent(externalId)}`, {
      fields,
    });
    await recordFsqUsage("details");

    const id = placeId(p);
    const c = coords(p);
    if (!id || !c) return null;
    const mapped = mapFsqCategoryToMvp(p.categories);
    const loc = p.location;
    return {
      provider: "foursquare",
      externalId: id,
      name: p.name?.trim() || "Place",
      latitude: c.lat,
      longitude: c.lng,
      category: mapped.category,
      sourceCategory: mapped.sourceCategory,
      formattedAddress: loc?.formatted_address ?? loc?.address,
      locality: loc?.locality,
      region: loc?.region,
      countryCode: loc?.country?.slice(0, 2)?.toUpperCase(),
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
    const data = await this.getJson<
      Array<{
        id?: string;
        prefix?: string;
        suffix?: string;
        width?: number;
        height?: number;
      }>
    >(`/places/${encodeURIComponent(externalId)}/photos`, {
      limit: Math.min(8, Math.max(1, limit)),
      sort: "POPULAR",
    });
    await recordFsqUsage("photos");

    const list = Array.isArray(data) ? data : [];
    const photos: PlacePhoto[] = [];
    list.forEach((ph, i) => {
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
    const data = await this.getJson<{
      results?: Array<{
        fsq_tip_id?: string;
        id?: string;
        text?: string;
        created_at?: string;
      }>;
    }>(`/places/${encodeURIComponent(externalId)}/tips`, {
      limit: Math.min(3, Math.max(1, limit)),
      sort: "POPULAR",
    });
    await recordFsqUsage("tips");

    const results = (data.results ??
      (Array.isArray(data) ? data : [])) as Array<{
      fsq_tip_id?: string;
      id?: string;
      text?: string;
      created_at?: string;
    }>;
    const tips: PlaceTip[] = [];
    for (const t of results) {
      const text = t.text?.trim();
      if (!text) continue;
      tips.push({
        id: t.fsq_tip_id ?? t.id ?? `tip-${tips.length}`,
        text,
        createdAt: t.created_at,
        attribution: ATTRIBUTION,
      });
      if (tips.length >= 3) break;
    }
    return tips;
  }
}

export function getFoursquarePlaceProvider(): FoursquarePlaceProvider | null {
  const key = process.env.FOURSQUARE_API_KEY?.trim();
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
