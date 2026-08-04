import type { GeocodingProvider } from "@/lib/geocoding/adapter";
import type { GeocodingResult } from "@/lib/geocoding/types";

/**
 * MapTiler Geocoding API implementation.
 *
 * Results are intended for interactive selection (search / reverse) while
 * the user is choosing a place. Persistence of any returned field into
 * canonical `places` rows must be verified against the MapTiler plan and
 * terms before production — do not treat provider feature IDs as stable FKs.
 */
export class MapTilerGeocodingProvider implements GeocodingProvider {
  constructor(private readonly apiKey: string) {}

  async search(q: string): Promise<GeocodingResult[]> {
    const query = q.trim();
    if (!query) return [];

    const url = new URL("https://api.maptiler.com/geocoding/" + encodeURIComponent(query) + ".json");
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("limit", "8");
    url.searchParams.set("language", "en");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`MapTiler geocoding failed (${res.status})`);
    }

    const data = (await res.json()) as {
      features?: Array<{
        id?: string;
        place_name?: string;
        text?: string;
        center?: [number, number];
        properties?: { country_code?: string };
        context?: Array<{ id?: string; short_code?: string }>;
      }>;
    };

    return (data.features ?? [])
      .filter((f) => Array.isArray(f.center) && f.center.length === 2)
      .map((f) => {
        const country =
          f.properties?.country_code?.toUpperCase() ??
          f.context?.find((c) => c.short_code?.includes("-") || c.id?.startsWith("country"))
            ?.short_code?.slice(-2)
            ?.toUpperCase() ??
          "US";

        return {
          name: f.text ?? f.place_name ?? "Unknown",
          lat: f.center![1],
          lng: f.center![0],
          countryCode: country.length === 2 ? country : "US",
          formattedAddress: f.place_name ?? f.text ?? "",
          provider: "maptiler",
          providerFeatureId: f.id,
          attribution: "© MapTiler © OpenStreetMap contributors",
        } satisfies GeocodingResult;
      });
  }

  async reverse(lat: number, lng: number): Promise<GeocodingResult | null> {
    const url = new URL(
      `https://api.maptiler.com/geocoding/${lng},${lat}.json`,
    );
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`MapTiler reverse geocoding failed (${res.status})`);
    }

    const data = (await res.json()) as {
      features?: Array<{
        id?: string;
        place_name?: string;
        text?: string;
        center?: [number, number];
        properties?: { country_code?: string };
      }>;
    };

    const f = data.features?.[0];
    if (!f?.center) return null;

    return {
      name: f.text ?? f.place_name ?? "Unknown",
      lat: f.center[1],
      lng: f.center[0],
      countryCode: f.properties?.country_code?.toUpperCase() ?? "US",
      formattedAddress: f.place_name ?? f.text ?? "",
      provider: "maptiler",
      providerFeatureId: f.id,
      attribution: "© MapTiler © OpenStreetMap contributors",
    };
  }
}
