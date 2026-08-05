import type { PlaceProvider } from "@/lib/places/provider";
import {
  FoursquarePlaceProvider,
  getFoursquarePlaceProvider,
} from "@/lib/places/providers/foursquare";
import { MapTilerPlaceProvider } from "@/lib/places/providers/maptiler";

/** MapTiler geocoding / reverse — interactive map search. */
export function getGeocodingProvider(): PlaceProvider | null {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) return new MapTilerPlaceProvider(key);
  return null;
}

/** @deprecated use getGeocodingProvider */
export function getPlaceProvider(): PlaceProvider | null {
  return getGeocodingProvider();
}

export function getDiscoveryProvider(): FoursquarePlaceProvider | null {
  return getFoursquarePlaceProvider();
}

export { MapTilerPlaceProvider, FoursquarePlaceProvider, getFoursquarePlaceProvider };
