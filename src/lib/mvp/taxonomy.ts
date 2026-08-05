/** Place categories (map to DB place_category). Additive FSQ-friendly split. */
export const PLACE_CATEGORIES = [
  { id: "hotel", label: "Hotel", db: "hotel" as const },
  { id: "restaurant", label: "Restaurant", db: "restaurant" as const },
  { id: "cafe", label: "Café or bakery", db: "cafe" as const },
  /** No `bar` enum yet — persist as restaurant until a migration adds it. */
  { id: "bar", label: "Bar or winery", db: "restaurant" as const },
  /** @deprecated Prefer restaurant / cafe / bar — kept for API back-compat. */
  { id: "food_drink", label: "Food & Drink", db: "restaurant" as const },
  { id: "beach", label: "Beach", db: "beach" as const },
  { id: "park", label: "Park or trail", db: "park" as const },
  { id: "attraction", label: "Attraction or activity", db: "attraction" as const },
  { id: "landmark", label: "Landmark or museum", db: "landmark" as const },
  { id: "shopping", label: "Shopping", db: "shopping" as const },
  { id: "transit", label: "Train or transit", db: "transport" as const },
  { id: "ferry", label: "Ferry or boat", db: "transport" as const },
  { id: "airport", label: "Airport", db: "transport" as const },
  /**
   * @deprecated Prefer transit / ferry / airport — kept for API / DB back-compat.
   * DB `transport` rows normalize to `transit` via dbToCategory.
   */
  { id: "transport", label: "Transportation or ferry", db: "transport" as const },
  { id: "pet_service", label: "Pet relief or pet service", db: "pet_service" as const },
  /** Locality / destination pin — no dedicated DB enum; persist as other. */
  { id: "destination", label: "Destination", db: "other" as const },
  { id: "other", label: "Other", db: "other" as const },
] as const;

const DEPRECATED_UI_IDS = new Set(["food_drink", "transport"]);

/** Categories shown in composers / filters (excludes deprecated aliases). */
export const PLACE_CATEGORIES_UI = PLACE_CATEGORIES.filter(
  (c) => !DEPRECATED_UI_IDS.has(c.id),
);

export type MvpCategoryId = (typeof PLACE_CATEGORIES)[number]["id"];
export type DbPlaceCategory = (typeof PLACE_CATEGORIES)[number]["db"];

export function categoryToDb(id: MvpCategoryId | string): DbPlaceCategory {
  return PLACE_CATEGORIES.find((c) => c.id === id)?.db ?? "other";
}

export function dbToCategory(db: string | null | undefined): MvpCategoryId {
  if (!db) return "other";
  if (db === "cafe") return "cafe";
  if (db === "restaurant") return "restaurant";
  if (db === "food_drink") return "restaurant";
  if (db === "transport") return "transit";
  const hit = PLACE_CATEGORIES.find((c) => c.db === db || c.id === db);
  return hit?.id ?? "other";
}

/** Optional dog-access badges — not a policy engine. */
export const DOG_BADGES = [
  { id: "dog_friendly", label: "Dog friendly" },
  { id: "dogs_permitted", label: "Dogs permitted" },
  { id: "indoors_allowed", label: "Indoors allowed" },
  { id: "outdoor_only", label: "Outdoor only" },
  { id: "on_ground", label: "Dogs allowed on the ground" },
  { id: "carrier_required", label: "Carrier required" },
  { id: "small_dogs_only", label: "Small dogs only" },
  { id: "large_dogs_welcome", label: "Large dogs welcome" },
  { id: "leash_required", label: "Leash required" },
  { id: "off_leash", label: "Off-leash area" },
  { id: "breed_restrictions", label: "Breed restrictions" },
  { id: "prior_approval", label: "Prior approval required" },
  { id: "pet_fee", label: "Pet fee" },
  { id: "unknown", label: "Dog policy unknown" },
] as const;

export type DogBadgeId = (typeof DOG_BADGES)[number]["id"];

export const DOG_BADGE_IDS = new Set(DOG_BADGES.map((b) => b.id));

/** App status → DB status (visited kept for legacy rows). */
export type MvpSaveStatus = "want_to_go" | "been_there";

export function toDbSaveStatus(status: MvpSaveStatus): "want_to_go" | "been_there" | "visited" {
  return status === "been_there" ? "been_there" : "want_to_go";
}

export function fromDbSaveStatus(status: string | null | undefined): MvpSaveStatus {
  if (status === "been_there" || status === "visited") return "been_there";
  return "want_to_go";
}

export function categoryLabel(id: MvpCategoryId | string): string {
  return PLACE_CATEGORIES.find((c) => c.id === id || c.db === id)?.label ?? "Place";
}
