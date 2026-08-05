import { ProviderHttpError } from "@/lib/discovery/errors";
import { mapOsmOrMapTilerCategory } from "@/lib/discovery/fsq-category-map";
import type { PlaceCandidate } from "@/lib/discovery/types";

export type RenderedPoiHit = {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  layerId?: string;
  className?: string;
  subclass?: string;
};

/** MapTiler Geocoding API accepts limit in [1, 10]. */
export const MAPTILER_GEOCODING_MAX_LIMIT = 10;

const SKIP_NAME =
  /^(north|south|east|west|unnamed|path|road|street|avenue|lane|way|drive)$/i;

/** Forward category queries used when reverse `types=poi` is sparse. */
const FALLBACK_POI_QUERIES = ["hotel", "restaurant", "cafe", "park", "shop"] as const;

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

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function redactSnippet(bodyText: string): string {
  return bodyText
    .replace(/[?&]key=[^&\s]+/gi, "[key=redacted]")
    .replace(/"key"\s*:\s*"[^"]+"/gi, '"key":"[redacted]"');
}

function bboxAround(lat: number, lng: number, radiusMeters: number): string {
  // ~111_320 m per degree latitude; longitude shrinks by cos(lat).
  const dLat = radiusMeters / 111_320;
  const dLng = radiusMeters / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const west = lng - dLng;
  const south = lat - dLat;
  const east = lng + dLng;
  const north = lat + dLat;
  return `${west},${south},${east},${north}`;
}

/** Convert MapLibre rendered POI hits into PlaceCandidates within radius. */
export function renderedPoisToCandidates(
  hits: RenderedPoiHit[],
  center: { lat: number; lng: number },
  radiusMeters: number,
): PlaceCandidate[] {
  const out: PlaceCandidate[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    const name = hit.name?.trim();
    if (!name || name.length < 2 || SKIP_NAME.test(name)) continue;
    const dist = haversineM(center, { lat: hit.lat, lng: hit.lng });
    if (dist > radiusMeters) continue;

    const key = hit.id
      ? `id:${hit.id}`
      : `n:${normalizeName(name)}:${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Deduplicate near-identical names within 40m
    const dup = out.find(
      (c) =>
        normalizeName(c.name) === normalizeName(name) &&
        haversineM(
          { lat: c.latitude, lng: c.longitude },
          { lat: hit.lat, lng: hit.lng },
        ) < 40,
    );
    if (dup) continue;

    const sourceCategory = hit.subclass || hit.className || hit.layerId || "poi";
    out.push({
      provider: "maptiler",
      externalId: hit.id ?? `mt-${hit.lng.toFixed(5)},${hit.lat.toFixed(5)}`,
      name,
      latitude: hit.lat,
      longitude: hit.lng,
      distanceMeters: Math.round(dist),
      category: mapOsmOrMapTilerCategory(sourceCategory),
      sourceCategory,
      attribution: "© MapTiler © OpenStreetMap contributors",
    });
  }

  return out
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
    .slice(0, 15);
}

type MapTilerFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  place_type?: string[];
  properties?: { category?: string };
};

function featuresToCandidates(
  features: MapTilerFeature[],
  center: { lat: number; lng: number },
  radiusMeters: number,
  limit: number,
): PlaceCandidate[] {
  const out: PlaceCandidate[] = [];
  const seen = new Set<string>();

  for (const f of features) {
    if (!Array.isArray(f.center) || f.center.length < 2) continue;
    const name = (f.text ?? f.place_name)?.trim();
    if (!name || name.length < 2 || SKIP_NAME.test(name)) continue;
    const lng = Number(f.center[0]);
    const lat = Number(f.center[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const dist = haversineM(center, { lat, lng });
    // Soft radius: MapTiler reverse/proximity can return slightly farther POIs.
    if (dist > radiusMeters * 1.5) continue;

    const externalId = String(f.id ?? `mt-${lng.toFixed(5)},${lat.toFixed(5)}`);
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const sourceCategory =
      f.properties?.category ?? f.place_type?.find((t) => t !== "poi") ?? "poi";
    out.push({
      provider: "maptiler",
      externalId,
      name,
      latitude: lat,
      longitude: lng,
      distanceMeters: Math.round(dist),
      category: mapOsmOrMapTilerCategory(sourceCategory),
      sourceCategory,
      formattedAddress: f.place_name,
      attribution: "© MapTiler © OpenStreetMap contributors",
    });
  }

  return out
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
    .slice(0, limit);
}

async function mapTilerGeocodeFetch(
  pathQuery: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<MapTilerFeature[]> {
  const url = new URL(`https://api.maptiler.com/geocoding/${pathQuery}.json`);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ProviderHttpError({
      status: 503,
      provider: "maptiler",
      endpoint: `/geocoding/${pathQuery}`,
      bodySnippet: `network: ${msg.slice(0, 180)}`,
    });
  }

  const bodyText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new ProviderHttpError({
      status: res.status,
      provider: "maptiler",
      endpoint: `/geocoding/${pathQuery}`,
      bodySnippet: redactSnippet(bodyText),
    });
  }

  if (!bodyText) return [];
  try {
    const data = JSON.parse(bodyText) as { features?: MapTilerFeature[] };
    return Array.isArray(data.features) ? data.features : [];
  } catch {
    throw new ProviderHttpError({
      status: 502,
      provider: "maptiler",
      endpoint: `/geocoding/${pathQuery}`,
      bodySnippet: "Invalid JSON response",
    });
  }
}

/**
 * Server-side MapTiler nearby POIs.
 * 1) Reverse geocode with `types=poi` (limit capped at 10 per MapTiler API).
 * 2) If sparse, forward category searches with proximity + bbox.
 */
export async function fetchMapTilerNearbyPois(input: {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit?: number;
  apiKey?: string;
}): Promise<PlaceCandidate[]> {
  const key = (input.apiKey ?? process.env.NEXT_PUBLIC_MAPTILER_KEY)?.trim();
  if (!key) {
    throw new ProviderHttpError({
      status: 503,
      provider: "maptiler",
      endpoint: "/geocoding",
      bodySnippet: "NEXT_PUBLIC_MAPTILER_KEY missing",
    });
  }

  const limit = Math.min(
    MAPTILER_GEOCODING_MAX_LIMIT,
    Math.max(1, input.limit ?? MAPTILER_GEOCODING_MAX_LIMIT),
  );
  const center = { lat: input.lat, lng: input.lng };
  const coordPath = `${input.lng},${input.lat}`;

  const reverseFeatures = await mapTilerGeocodeFetch(
    coordPath,
    {
      types: "poi",
      limit: String(limit),
      language: "en",
    },
    key,
  );

  let candidates = featuresToCandidates(
    reverseFeatures,
    center,
    input.radiusMeters,
    limit,
  );

  if (candidates.length >= Math.min(4, limit)) {
    return candidates;
  }

  // Category forward search — MapTiler supports bare POI category queries.
  const bbox = bboxAround(input.lat, input.lng, Math.max(input.radiusMeters, 400));
  const proximity = `${input.lng},${input.lat}`;
  const seenIds = new Set(candidates.map((c) => c.externalId));
  const mergedFeatures: MapTilerFeature[] = [...reverseFeatures];

  for (const q of FALLBACK_POI_QUERIES) {
    if (candidates.length >= limit) break;
    try {
      const features = await mapTilerGeocodeFetch(
        encodeURIComponent(q),
        {
          types: "poi",
          limit: String(Math.min(5, limit)),
          language: "en",
          proximity,
          bbox,
        },
        key,
      );
      for (const f of features) {
        const id = String(f.id ?? "");
        if (id && seenIds.has(id)) continue;
        if (id) seenIds.add(id);
        mergedFeatures.push(f);
      }
      candidates = featuresToCandidates(
        mergedFeatures,
        center,
        input.radiusMeters,
        limit,
      );
    } catch {
      // Keep reverse results; individual category query failures are non-fatal.
    }
  }

  return candidates;
}
