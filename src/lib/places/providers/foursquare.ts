import type {
  CoordinateInput,
  ExternalPlace,
  NearbyPlaceInput,
  PlaceProvider,
  PlaceSearchInput,
  ReverseGeocodeResult,
} from "@/lib/places/provider";

/**
 * Future Foursquare / FSQ OS Places provider.
 * Stubbed so enrichment can plug in without rewriting Explore.
 * Next: FSQ OS Places for licensed POI enrichment (not required for Phase 9).
 */
export class FoursquarePlaceProvider implements PlaceProvider {
  constructor(private readonly apiKey?: string) {}

  async searchPlaces(_input: PlaceSearchInput): Promise<ExternalPlace[]> {
    void _input;
    void this.apiKey;
    return [];
  }

  async getNearbyPlaces(_input: NearbyPlaceInput): Promise<ExternalPlace[]> {
    void _input;
    return [];
  }

  async reverseGeocode(_input: CoordinateInput): Promise<ReverseGeocodeResult> {
    void _input;
    return { place: null, nearby: [] };
  }
}
