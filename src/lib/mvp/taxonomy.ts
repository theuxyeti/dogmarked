/** Simplified MVP place categories (map to DB place_category). */
export const PLACE_CATEGORIES = [
  { id: "hotel", label: "Hotel", db: "hotel" as const },
  { id: "food_drink", label: "Food & Drink", db: "restaurant" as const },
  { id: "beach", label: "Beach", db: "beach" as const },
  { id: "park", label: "Park or Trail", db: "park" as const },
  { id: "attraction", label: "Attraction", db: "attraction" as const },
  { id: "landmark", label: "Landmark", db: "landmark" as const },
  { id: "shopping", label: "Shopping", db: "shopping" as const },
  { id: "transport", label: "Transportation or Ferry", db: "transport" as const },
  { id: "pet_service", label: "Pet Service", db: "pet_service" as const },
  { id: "other", label: "Other", db: "other" as const },
] as const;

export type MvpCategoryId = (typeof PLACE_CATEGORIES)[number]["id"];
export type DbPlaceCategory = (typeof PLACE_CATEGORIES)[number]["db"];

export function categoryToDb(id: MvpCategoryId): DbPlaceCategory {
  return PLACE_CATEGORIES.find((c) => c.id === id)?.db ?? "other";
}

export function dbToCategory(db: string | null | undefined): MvpCategoryId {
  if (!db) return "other";
  if (db === "cafe" || db === "restaurant") return "food_drink";
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
