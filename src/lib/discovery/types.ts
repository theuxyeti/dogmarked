import type { MvpCategoryId } from "@/lib/mvp/taxonomy";
import type { MarkerShellStatus } from "@/lib/map/marker-policy";
import type { PetPolicyOverallStatus } from "@/lib/policy/evidence";

export type DiscoveryProviderId = "foursquare" | "maptiler" | "dogmarked" | "custom";

export type GeocodeResultKind = "locality" | "region" | "address" | "poi" | "unknown";

export type CatalogCoverage = "covered" | "partial" | "uncovered";

export interface PlaceCandidate {
  provider: DiscoveryProviderId;
  externalId: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  category: MvpCategoryId;
  sourceCategory?: string;
  formattedAddress?: string;
  locality?: string;
  region?: string;
  countryCode?: string;
  website?: string;
  phone?: string;
  thumbnailUrl?: string;
  attribution?: string;
  /** Present when already in Dogmarked */
  canonicalId?: string;
  slug?: string;
  publicContributorCount?: number;
  alreadySavedByMe?: boolean;
  mySaveStatus?: "want_to_go" | "been_there";
  /**
   * Dogmarked-derived policy shell for markers/filters.
   * Never inferred from Foursquare friendliness.
   */
  policyStatus?: MarkerShellStatus;
  /** Structured overall status when pet_policy_reports exist. */
  overallStatus?: PetPolicyOverallStatus;
}

export interface PlacePhoto {
  id: string;
  url: string;
  width?: number;
  height?: number;
  attribution?: string;
}

export interface PlaceTip {
  id: string;
  text: string;
  createdAt?: string;
  attribution?: string;
}

export interface PlaceDetails {
  provider: DiscoveryProviderId;
  externalId: string;
  name: string;
  latitude: number;
  longitude: number;
  category: MvpCategoryId;
  sourceCategory?: string;
  formattedAddress?: string;
  locality?: string;
  region?: string;
  countryCode?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  hoursSummary?: string;
  openNow?: boolean | null;
  description?: string;
  attribution: string;
  pricingTier?: string;
}

export interface NearbySearchInput {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  limit: number;
}

export interface ResolveCandidateInput {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface NearbyDiscoveryResponse {
  candidates: PlaceCandidate[];
  catalogCoverage: CatalogCoverage;
  fallbackRecommended: boolean;
  radiusMeters: number;
  discoveryAvailable: boolean;
  /** True when candidates came from MapTiler because Foursquare failed/empty. */
  usedFallback?: boolean;
  fallbackProvider?: "maptiler";
  /** Structured provider/config failure — absent on success (including empty results). */
  discoveryError?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  enrichment?: {
    photosEnabled: boolean;
    tipsEnabled: boolean;
    premiumDetailsEnabled: boolean;
  };
  label?: string;
}

export const RADIUS_PRESETS_M = [160, 400, 800] as const;
export const DEFAULT_RADIUS_M = 400;
export const MAX_NEARBY_RESULTS = 15;
export const MIN_RADIUS_M = 50;
export const MAX_RADIUS_M = 2000;
export const UI_MAX_RADIUS_M = 800;

export function clampRadiusMeters(raw: number, forUi = true): number {
  const max = forUi ? UI_MAX_RADIUS_M : MAX_RADIUS_M;
  if (!Number.isFinite(raw)) return DEFAULT_RADIUS_M;
  return Math.min(max, Math.max(MIN_RADIUS_M, Math.round(raw)));
}
