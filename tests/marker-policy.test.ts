import { describe, expect, it } from "vitest";
import { mapFsqCategoryToMvp } from "@/lib/discovery/fsq-category-map";
import { categoryEmoji } from "@/lib/discovery/category-icons";
import {
  categoryToDb,
  dbToCategory,
  PLACE_CATEGORIES_UI,
} from "@/lib/mvp/taxonomy";
import {
  isKnownDogFriendly,
  markerAriaLabel,
  markerShellClassName,
  markerStatusFromDogStatus,
  markerStatusFromOverall,
  passesDogFriendlyFilter,
  resolveMarkerPolicyStatus,
} from "@/lib/map/marker-policy";

describe("Phase 7 category registry", () => {
  it("exposes plan categories in UI registry", () => {
    const ids = PLACE_CATEGORIES_UI.map((c) => c.id);
    for (const id of [
      "hotel",
      "restaurant",
      "cafe",
      "bar",
      "beach",
      "park",
      "landmark",
      "attraction",
      "transit",
      "ferry",
      "airport",
      "pet_service",
      "shopping",
      "destination",
      "other",
    ]) {
      expect(ids).toContain(id);
    }
    expect(ids).not.toContain("food_drink");
    expect(ids).not.toContain("transport");
  });

  it("maps UI categories to DB additively", () => {
    expect(categoryToDb("transit")).toBe("transport");
    expect(categoryToDb("ferry")).toBe("transport");
    expect(categoryToDb("airport")).toBe("transport");
    expect(categoryToDb("destination")).toBe("other");
    expect(categoryToDb("bar")).toBe("restaurant");
    expect(dbToCategory("transport")).toBe("transit");
  });

  it("maps FSQ / OSM labels into semantic categories", () => {
    expect(mapFsqCategoryToMvp([{ name: "Coffee Shop" }]).category).toBe("cafe");
    expect(mapFsqCategoryToMvp([{ name: "Wine Bar" }]).category).toBe("bar");
    expect(mapFsqCategoryToMvp([{ name: "Ferry Terminal" }]).category).toBe(
      "ferry",
    );
    expect(mapFsqCategoryToMvp([{ name: "Train Station" }]).category).toBe(
      "transit",
    );
    expect(mapFsqCategoryToMvp([{ name: "International Airport" }]).category).toBe(
      "airport",
    );
  });

  it("has emoji for each registry category", () => {
    expect(categoryEmoji("hotel")).toBe("🏨");
    expect(categoryEmoji("transit")).toBe("🚆");
    expect(categoryEmoji("ferry")).toBe("⛴️");
    expect(categoryEmoji("airport")).toBe("✈️");
    expect(categoryEmoji("destination")).toBe("📍");
  });
});

describe("marker policy status", () => {
  it("maps overall and legacy dog status onto shells", () => {
    expect(markerStatusFromOverall("confirmed")).toBe("confirmed");
    expect(markerStatusFromOverall("ask_first")).toBe("restricted");
    expect(markerStatusFromOverall("not_allowed")).toBe("not_allowed");
    expect(markerStatusFromDogStatus("dogs_welcome")).toBe("confirmed");
    expect(markerStatusFromDogStatus("no_dogs")).toBe("not_allowed");
  });

  it("resolves from Dogmarked evidence only", () => {
    expect(
      resolveMarkerPolicyStatus({
        overallStatus: "confirmed",
        dogStatus: "no_dogs",
      }),
    ).toBe("confirmed");

    expect(
      resolveMarkerPolicyStatus({
        dogBadges: ["dog_friendly"],
      }),
    ).toBe("community");

    expect(
      resolveMarkerPolicyStatus({
        dogBadges: ["outdoor_only", "pet_fee"],
      }),
    ).toBe("restricted");

    expect(resolveMarkerPolicyStatus({})).toBe("unknown");
  });

  it("builds accessible labels and policy shell classes", () => {
    expect(markerAriaLabel("hotel", "unknown")).toBe(
      "Hotel, dog policy unknown",
    );
    expect(markerShellClassName("not_allowed")).toBe(
      "dm-marker dm-marker--not-allowed",
    );
    expect(markerShellClassName("confirmed")).toBe(
      "dm-marker dm-marker--confirmed",
    );
  });

  it("filters known dog-friendly vs include unknown", () => {
    expect(isKnownDogFriendly("confirmed")).toBe(true);
    expect(isKnownDogFriendly("community")).toBe(true);
    expect(isKnownDogFriendly("unknown")).toBe(false);
    expect(isKnownDogFriendly("not_allowed")).toBe(false);

    expect(passesDogFriendlyFilter("unknown", "include_unknown")).toBe(true);
    expect(passesDogFriendlyFilter("unknown", "known_only")).toBe(false);
    expect(passesDogFriendlyFilter("confirmed", "known_only")).toBe(true);
    expect(passesDogFriendlyFilter("not_allowed", "known_only")).toBe(false);
  });
});
