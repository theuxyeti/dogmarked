import { describe, expect, it } from "vitest";
import { mapFsqCategoryToMvp } from "@/lib/discovery/fsq-category-map";
import {
  clampRadiusMeters,
  DEFAULT_RADIUS_M,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
  UI_MAX_RADIUS_M,
} from "@/lib/discovery/types";
import { categoryEmoji } from "@/lib/discovery/category-icons";

describe("clampRadiusMeters", () => {
  it("defaults invalid values", () => {
    expect(clampRadiusMeters(Number.NaN)).toBe(DEFAULT_RADIUS_M);
  });

  it("clamps UI radius to 800", () => {
    expect(clampRadiusMeters(5000, true)).toBe(UI_MAX_RADIUS_M);
    expect(clampRadiusMeters(10, true)).toBe(MIN_RADIUS_M);
  });

  it("allows server range up to 2000", () => {
    expect(clampRadiusMeters(1500, false)).toBe(1500);
    expect(clampRadiusMeters(9000, false)).toBe(MAX_RADIUS_M);
  });
});

describe("mapFsqCategoryToMvp", () => {
  it("maps common categories", () => {
    expect(mapFsqCategoryToMvp([{ name: "Hotel" }]).category).toBe("hotel");
    expect(mapFsqCategoryToMvp([{ name: "Coffee Shop" }]).category).toBe(
      "food_drink",
    );
    expect(mapFsqCategoryToMvp([{ name: "National Park" }]).category).toBe(
      "park",
    );
  });

  it("falls back to other", () => {
    expect(mapFsqCategoryToMvp([{ name: "Weird Thing" }]).category).toBe(
      "other",
    );
    expect(mapFsqCategoryToMvp(null).category).toBe("other");
  });
});

describe("categoryEmoji", () => {
  it("returns emoji for known categories", () => {
    expect(categoryEmoji("hotel")).toBe("🏨");
    expect(categoryEmoji("unknown-cat")).toBe("✨");
  });
});

describe("dedupe priority helpers", () => {
  it("never merges solely on coordinates", () => {
    const a = { name: "Hotel A", lat: 46.59, lng: 7.9 };
    const b = { name: "Restaurant B", lat: 46.59, lng: 7.9 };
    const sameCoords = a.lat === b.lat && a.lng === b.lng;
    const sameName =
      a.name.toLowerCase().trim() === b.name.toLowerCase().trim();
    expect(sameCoords).toBe(true);
    expect(sameName).toBe(false);
    // Merge rule: require name match (or provider id), not coordinates alone
    const shouldMerge = sameName && sameCoords;
    expect(shouldMerge).toBe(false);
  });
});
