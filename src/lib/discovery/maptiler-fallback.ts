import type { PlaceCandidate } from "@/lib/discovery/types";
import { mapOsmOrMapTilerCategory } from "@/lib/discovery/fsq-category-map";

export type RenderedPoiHit = {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  layerId?: string;
  className?: string;
  subclass?: string;
};

const SKIP_NAME =
  /^(north|south|east|west|unnamed|path|road|street|avenue|lane|way|drive)$/i;

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

/**
 * Server-side MapTiler reverse geocode with `types=poi`.
 * Used when Foursquare nearby fails so the drawer still has real places.
 */
export async function fetchMapTilerNearbyPois(input: {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit?: number;
  apiKey?: string;
}): Promise<PlaceCandidate[]> {
  const key = (input.apiKey ?? process.env.NEXT_PUBLIC_MAPTILER_KEY)?.trim();
  if (!key) return [];

  const limit = Math.min(15, Math.max(1, input.limit ?? 12));
  const url = new URL(
    `https://api.maptiler.com/geocoding/${input.lng},${input.lat}.json`,
  );
  url.searchParams.set("key", key);
  url.searchParams.set("types", "poi");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: MapTilerFeature[] };
  const center = { lat: input.lat, lng: input.lng };
  const out: PlaceCandidate[] = [];
  const seen = new Set<string>();

  for (const f of data.features ?? []) {
    if (!Array.isArray(f.center) || f.center.length < 2) continue;
    const name = (f.text ?? f.place_name)?.trim();
    if (!name || name.length < 2 || SKIP_NAME.test(name)) continue;
    const lng = Number(f.center[0]);
    const lat = Number(f.center[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const dist = haversineM(center, { lat, lng });
    // Soft radius: MapTiler reverse can return slightly farther POIs; allow 1.5×.
    if (dist > input.radiusMeters * 1.5) continue;

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
