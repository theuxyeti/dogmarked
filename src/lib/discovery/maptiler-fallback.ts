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

  return out.sort(
    (a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0),
  ).slice(0, 15);
}
