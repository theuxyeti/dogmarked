/**
 * Place provider adapter — interactive discovery only.
 * Do not treat provider feature IDs as stable place PKs.
 * Persist only licensable fields via `external_place_refs` after user save/contribute.
 */

export interface CoordinateInput {
  lat: number;
  lng: number;
}

export interface PlaceSearchInput {
  query: string;
  /** Viewport bias [minLng, minLat, maxLng, maxLat] */
  bbox?: [number, number, number, number];
  proximity?: CoordinateInput;
  limit?: number;
  /** Places (POIs) vs Destinations (regions/cities) */
  kinds?: Array<"place" | "destination">;
}

export interface NearbyPlaceInput extends CoordinateInput {
  radiusMeters?: number;
  limit?: number;
}

export interface ExternalPlace {
  provider: string;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
  formattedAddress: string;
  category?: string | null;
  kind: "place" | "destination";
  attribution: string;
  /** Normalized licensable subset only — never store full provider payload blindly */
  normalized: Record<string, string | number | null>;
}

export interface ReverseGeocodeResult {
  place: ExternalPlace | null;
  nearby: ExternalPlace[];
}

export interface PlaceProvider {
  searchPlaces(input: PlaceSearchInput): Promise<ExternalPlace[]>;
  getNearbyPlaces(input: NearbyPlaceInput): Promise<ExternalPlace[]>;
  reverseGeocode(input: CoordinateInput): Promise<ReverseGeocodeResult>;
}
