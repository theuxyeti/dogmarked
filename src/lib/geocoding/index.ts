import type { GeocodingProvider } from "@/lib/geocoding/adapter";
import { MapTilerGeocodingProvider } from "@/lib/geocoding/maptiler";
import type { GeocodingResult } from "@/lib/geocoding/types";
import { SOUTH_FLORIDA_PLACES } from "@/lib/places/fixtures";

class FixtureGeocodingProvider implements GeocodingProvider {
  async search(q: string): Promise<GeocodingResult[]> {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];

    return SOUTH_FLORIDA_PLACES.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.city?.toLowerCase().includes(needle) ||
        p.slug.includes(needle),
    ).map((p) => ({
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      countryCode: p.countryCode,
      formattedAddress: [p.address, p.city, p.region, p.countryCode]
        .filter(Boolean)
        .join(", "),
      provider: "fixture",
      attribution: "Dogmarked curated fixtures",
    }));
  }

  async reverse(lat: number, lng: number): Promise<GeocodingResult | null> {
    let best = SOUTH_FLORIDA_PLACES[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const p of SOUTH_FLORIDA_PLACES) {
      const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (!best) return null;
    return {
      name: best.name,
      lat: best.lat,
      lng: best.lng,
      countryCode: best.countryCode,
      formattedAddress: [best.address, best.city, best.region]
        .filter(Boolean)
        .join(", "),
      provider: "fixture",
      attribution: "Dogmarked curated fixtures",
    };
  }
}

export function getGeocodingProvider(): GeocodingProvider {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) return new MapTilerGeocodingProvider(key);
  return new FixtureGeocodingProvider();
}

export type { GeocodingProvider } from "@/lib/geocoding/adapter";
export type { GeocodingResult } from "@/lib/geocoding/types";
