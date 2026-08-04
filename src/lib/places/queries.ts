import { SOUTH_FLORIDA_PLACES } from "@/lib/places/fixtures";
import type { DogPolicy, PlaceWithPolicy } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

function inBbox(lat: number, lng: number, bbox: Bbox): boolean {
  return (
    lng >= bbox.minLng &&
    lng <= bbox.maxLng &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

function mapPolicy(row: Record<string, unknown>, placeId: string): DogPolicy {
  return {
    id: row.id as string | undefined,
    placeId,
    dogStatus: (row.dog_status as DogPolicy["dogStatus"]) ?? "ask_first",
    access: (row.access as string[]) ?? [],
    maxDogs: (row.max_dogs as number | null) ?? null,
    maxWeightKg: (row.max_weight_kg as number | null) ?? null,
    maxCombinedWeightKg: (row.max_combined_weight_kg as number | null) ?? null,
    smallDogsOnly: Boolean(row.small_dogs_only),
    carrierRequired: Boolean(row.carrier_required),
    leashRequired: Boolean(row.leash_required ?? true),
    advanceApprovalRequired: Boolean(row.advance_approval_required),
    feeType: (row.fee_type as DogPolicy["feeType"]) ?? "unknown",
    feeAmount: (row.fee_amount as number | null) ?? null,
    feeCurrency: (row.fee_currency as string | null) ?? "USD",
    exceptionText: (row.exception_text as string | null) ?? null,
    sourceType: (row.source_type as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    confidence:
      typeof row.confidence === "number"
        ? row.confidence
        : Number(row.confidence ?? 0.5),
    lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
  };
}

function mapPlaceRow(row: Record<string, unknown>): PlaceWithPolicy {
  const id = String(row.id);
  const policyRow = row.dog_policies as Record<string, unknown> | Record<string, unknown>[] | null;
  const policy =
    Array.isArray(policyRow)
      ? policyRow[0]
        ? mapPolicy(policyRow[0], id)
        : null
      : policyRow
        ? mapPolicy(policyRow, id)
        : null;

  return {
    id,
    name: String(row.name),
    slug: String(row.slug),
    category: row.category as PlaceWithPolicy["category"],
    lat: Number(row.lat),
    lng: Number(row.lng),
    countryCode: String(row.country_code ?? "US"),
    address:
      (row.address_line1 as string | null) ??
      (typeof row.address === "string" ? row.address : null),
    city: (row.city as string | null) ?? null,
    region: (row.region as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    status: (row.status as PlaceWithPolicy["status"]) ?? "active",
    sourceType: (row.source_type as string | null) ?? null,
    sourceAttribution: (row.source_attribution as string | null) ?? null,
    policy,
  };
}

async function getSupabase() {
  const { tryCreateServerClient } = await import("@/lib/supabase/server");
  return tryCreateServerClient();
}

export async function getPlacesInBbox(bbox: Bbox): Promise<PlaceWithPolicy[]> {
  if (!isSupabaseConfigured()) {
    return SOUTH_FLORIDA_PLACES.filter((p) => inBbox(p.lat, p.lng, bbox));
  }

  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return SOUTH_FLORIDA_PLACES.filter((p) => inBbox(p.lat, p.lng, bbox));
    }

    const { data, error } = await supabase
      .from("places")
      .select("*, dog_policies(*)")
      .eq("status", "active")
      .gte("lat", bbox.minLat)
      .lte("lat", bbox.maxLat)
      .gte("lng", bbox.minLng)
      .lte("lng", bbox.maxLng);

    if (error || !data) {
      console.warn("getPlacesInBbox supabase error, using fixtures:", error?.message);
      return SOUTH_FLORIDA_PLACES.filter((p) => inBbox(p.lat, p.lng, bbox));
    }

    return data.map((row) => mapPlaceRow(row as Record<string, unknown>));
  } catch (err) {
    console.warn("getPlacesInBbox failed, using fixtures:", err);
    return SOUTH_FLORIDA_PLACES.filter((p) => inBbox(p.lat, p.lng, bbox));
  }
}

export async function getPlaceBySlug(slug: string): Promise<PlaceWithPolicy | null> {
  if (!isSupabaseConfigured()) {
    return SOUTH_FLORIDA_PLACES.find((p) => p.slug === slug) ?? null;
  }

  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return SOUTH_FLORIDA_PLACES.find((p) => p.slug === slug) ?? null;
    }

    const { data, error } = await supabase
      .from("places")
      .select("*, dog_policies(*)")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      return SOUTH_FLORIDA_PLACES.find((p) => p.slug === slug) ?? null;
    }

    return mapPlaceRow(data as Record<string, unknown>);
  } catch {
    return SOUTH_FLORIDA_PLACES.find((p) => p.slug === slug) ?? null;
  }
}

/** South Florida default viewport covering Boca → Miami. */
export const DEFAULT_BBOX: Bbox = {
  minLng: -80.35,
  minLat: 25.6,
  maxLng: -80.0,
  maxLat: 26.45,
};
