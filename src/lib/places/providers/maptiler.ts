import type {
  CoordinateInput,
  ExternalPlace,
  NearbyPlaceInput,
  PlaceProvider,
  PlaceSearchInput,
  ReverseGeocodeResult,
} from "@/lib/places/provider";

type MapTilerFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  center?: [number, number];
  place_type?: string[];
  properties?: { category?: string; country_code?: string };
  context?: Array<{ id?: string; short_code?: string }>;
};

function countryFromFeature(f: MapTilerFeature): string {
  const fromProps = f.properties?.country_code?.toUpperCase();
  if (fromProps && fromProps.length === 2) return fromProps;
  const ctx = f.context?.find(
    (c) => c.short_code?.includes("-") || c.id?.startsWith("country"),
  );
  const code = ctx?.short_code?.slice(-2)?.toUpperCase();
  return code && code.length === 2 ? code : "US";
}

function kindFromFeature(f: MapTilerFeature): "place" | "destination" {
  const types = f.place_type ?? [];
  if (
    types.some((t) =>
      ["country", "region", "place", "locality", "district", "municipality"].includes(t),
    ) &&
    !types.some((t) => ["poi", "address"].includes(t))
  ) {
    return "destination";
  }
  return "place";
}

function toExternal(f: MapTilerFeature): ExternalPlace | null {
  if (!Array.isArray(f.center) || f.center.length < 2) return null;
  const name = f.text ?? f.place_name ?? "Unknown";
  return {
    provider: "maptiler",
    externalId: String(f.id ?? `${f.center[0]},${f.center[1]}`),
    name,
    lat: f.center[1],
    lng: f.center[0],
    countryCode: countryFromFeature(f),
    formattedAddress: f.place_name ?? name,
    category: f.properties?.category ?? f.place_type?.[0] ?? null,
    kind: kindFromFeature(f),
    attribution: "© MapTiler © OpenStreetMap contributors",
    normalized: {
      name,
      lat: f.center[1],
      lng: f.center[0],
      country_code: countryFromFeature(f),
      formatted_address: f.place_name ?? name,
      category: f.properties?.category ?? null,
    },
  };
}

/**
 * MapTiler Geocoding as PlaceProvider.
 * Interactive selection only — confirm storage rights before persisting fields.
 */
export class MapTilerPlaceProvider implements PlaceProvider {
  constructor(private readonly apiKey: string) {}

  async searchPlaces(input: PlaceSearchInput): Promise<ExternalPlace[]> {
    const query = input.query.trim();
    if (query.length < 3) return [];

    const url = new URL(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`,
    );
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("limit", String(input.limit ?? 8));
    url.searchParams.set("language", "en");
    if (input.proximity) {
      url.searchParams.set(
        "proximity",
        `${input.proximity.lng},${input.proximity.lat}`,
      );
    }
    if (input.bbox) {
      url.searchParams.set("bbox", input.bbox.join(","));
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`MapTiler search failed (${res.status})`);
    }
    const data = (await res.json()) as { features?: MapTilerFeature[] };
    let results = (data.features ?? [])
      .map(toExternal)
      .filter((p): p is ExternalPlace => p != null);

    if (input.kinds?.length) {
      results = results.filter((r) => input.kinds!.includes(r.kind));
    }
    return results;
  }

  async getNearbyPlaces(input: NearbyPlaceInput): Promise<ExternalPlace[]> {
    // MapTiler geocoding reverse returns nearby candidates; radius is soft bias only.
    const reverse = await this.reverseGeocode(input);
    return reverse.nearby.slice(0, input.limit ?? 6);
  }

  async reverseGeocode(input: CoordinateInput): Promise<ReverseGeocodeResult> {
    const url = new URL(
      `https://api.maptiler.com/geocoding/${input.lng},${input.lat}.json`,
    );
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("limit", "6");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`MapTiler reverse failed (${res.status})`);
    }
    const data = (await res.json()) as { features?: MapTilerFeature[] };
    const places = (data.features ?? [])
      .map(toExternal)
      .filter((p): p is ExternalPlace => p != null);

    return {
      place: places[0] ?? null,
      nearby: places.slice(1),
    };
  }
}
