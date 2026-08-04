import type { GeocodingResult } from "@/lib/geocoding/types";

export interface GeocodingProvider {
  search(q: string): Promise<GeocodingResult[]>;
  reverse(lat: number, lng: number): Promise<GeocodingResult | null>;
}
