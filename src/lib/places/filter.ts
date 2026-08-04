import type { PlaceWithPolicy } from "@/lib/types";
import type { ExploreFilters } from "@/lib/url-state";

/** Apply Explore category / dog-status / text / layer filters client-side. */
export function filterPlaces(
  places: PlaceWithPolicy[],
  filters: ExploreFilters,
  options?: { savedPlaceIds?: Set<string> },
): PlaceWithPolicy[] {
  const q = filters.query.trim().toLowerCase();
  const savedIds = options?.savedPlaceIds;

  return places.filter((place) => {
    if (filters.categories.length && !filters.categories.includes(place.category)) {
      return false;
    }

    if (filters.dogStatuses.length) {
      const status = place.policy?.dogStatus;
      if (!status || !filters.dogStatuses.includes(status)) return false;
    }

    if (q) {
      const haystack = [place.name, place.city, place.category, place.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.layer === "saved") {
      if (!savedIds?.has(place.id)) return false;
    }

    if (filters.layer === "verified") {
      if (!place.policy?.lastVerifiedAt) return false;
    }

    if (filters.layer === "needs_verification") {
      if (place.policy?.lastVerifiedAt) return false;
    }

    return true;
  });
}
