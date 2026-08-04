export interface GeocodingResult {
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
  formattedAddress: string;
  provider: string;
  providerFeatureId?: string;
  attribution: string;
}
