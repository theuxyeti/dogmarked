import type { PlaceProvider } from "@/lib/places/provider";
import { FoursquarePlaceProvider } from "@/lib/places/providers/foursquare";
import { MapTilerPlaceProvider } from "@/lib/places/providers/maptiler";

/** Active interactive provider — MapTiler today; FSQ OS Places next enrichment. */
export function getPlaceProvider(): PlaceProvider | null {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) return new MapTilerPlaceProvider(key);
  return null;
}

export function getFoursquarePlaceProviderStub(): PlaceProvider {
  return new FoursquarePlaceProvider(process.env.FOURSQUARE_API_KEY);
}

export { MapTilerPlaceProvider, FoursquarePlaceProvider };
