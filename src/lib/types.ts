export type PlaceCategory =
  | "park"
  | "restaurant"
  | "beach"
  | "hotel"
  | "cafe"
  | "other"
  | "attraction"
  | "landmark"
  | "shopping"
  | "transport"
  | "pet_service";

export type PlaceStatus = "active" | "closed" | "duplicate_merged";

/** Matches public.dog_status enum */
export type DogStatus =
  | "dogs_welcome"
  | "dogs_ok_outdoors"
  | "dogs_ok_with_restrictions"
  | "ask_first"
  | "service_animals_only"
  | "no_dogs";

/** Matches public.fee_type enum */
export type FeeType = "none" | "flat" | "per_dog" | "per_night" | "deposit" | "unknown";

export type SaveStatus = "want_to_go" | "been_there" | "visited" | "recommended";

export type SaveVisibility = "private" | "link" | "public";

/** MVP save statuses shown in UI */
export type MvpSaveStatus = "want_to_go" | "been_there";

export type CompatibilityVerdict =
  | "good_match"
  | "ask_first"
  | "not_a_match"
  | "unknown";

export type SizeClass = "toy" | "small" | "medium" | "large" | "giant" | "unknown";

export interface Place {
  id: string;
  name: string;
  slug: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  countryCode: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  website?: string | null;
  phone?: string | null;
  status: PlaceStatus;
  sourceType?: string | null;
  sourceAttribution?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DogPolicy {
  id?: string;
  placeId: string;
  dogStatus: DogStatus;
  access: string[];
  maxDogs: number | null;
  maxWeightKg: number | null;
  maxCombinedWeightKg: number | null;
  smallDogsOnly: boolean;
  carrierRequired: boolean;
  leashRequired: boolean;
  advanceApprovalRequired: boolean;
  feeType: FeeType;
  feeAmount: number | null;
  feeCurrency: string | null;
  exceptionText: string | null;
  seasonalNotes: string | null;
  seasonalStartMonth: number | null;
  seasonalEndMonth: number | null;
  sourceType: string | null;
  sourceUrl: string | null;
  /** 0–1 numeric confidence from dog_policies.confidence */
  confidence: number;
  lastVerifiedAt: string | null;
}

export interface DogProfile {
  id: string;
  userId?: string | null;
  name: string;
  weightKg: number;
  sizeClass: SizeClass;
  travelsInCarrier: boolean;
}

export interface PlaceWithPolicy extends Place {
  policy: DogPolicy | null;
}

export interface CompatibilityResult {
  verdict: CompatibilityVerdict;
  reasons: string[];
  label: string;
}

export interface UserPlaceSave {
  placeId: string;
  status: SaveStatus;
  visibility: SaveVisibility;
  privateNotes?: string | null;
}
