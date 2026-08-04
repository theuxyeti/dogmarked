import { describe, expect, it } from "vitest";
import { filterPlaces } from "@/lib/places/filter";
import type { PlaceWithPolicy } from "@/lib/types";
import {
  DEFAULT_EXPLORE_STATE,
  exploreStateToSearchString,
  parseExploreUrlState,
} from "@/lib/url-state";

const sample: PlaceWithPolicy[] = [
  {
    id: "1",
    name: "Red Reef Park",
    slug: "red-reef",
    category: "park",
    lat: 26.3,
    lng: -80.07,
    countryCode: "US",
    city: "Boca Raton",
    status: "active",
    policy: {
      placeId: "1",
      dogStatus: "dogs_ok_outdoors",
      access: ["outdoor"],
      maxDogs: 2,
      maxWeightKg: null,
      maxCombinedWeightKg: null,
      smallDogsOnly: false,
      carrierRequired: false,
      leashRequired: true,
      advanceApprovalRequired: false,
      feeType: "none",
      feeAmount: null,
      feeCurrency: "USD",
      exceptionText: null,
      seasonalNotes: null,
      seasonalStartMonth: null,
      seasonalEndMonth: null,
      sourceType: "curated",
      sourceUrl: null,
      confidence: 0.8,
      lastVerifiedAt: "2026-01-01",
    },
  },
  {
    id: "2",
    name: "Cafe Munch",
    slug: "cafe-munch",
    category: "cafe",
    lat: 26.2,
    lng: -80.1,
    countryCode: "US",
    city: "Miami",
    status: "active",
    policy: {
      placeId: "2",
      dogStatus: "ask_first",
      access: ["outdoor"],
      maxDogs: 1,
      maxWeightKg: null,
      maxCombinedWeightKg: null,
      smallDogsOnly: true,
      carrierRequired: false,
      leashRequired: true,
      advanceApprovalRequired: false,
      feeType: "unknown",
      feeAmount: null,
      feeCurrency: "USD",
      exceptionText: null,
      seasonalNotes: null,
      seasonalStartMonth: null,
      seasonalEndMonth: null,
      sourceType: "firsthand",
      sourceUrl: null,
      confidence: 0.4,
      lastVerifiedAt: null,
    },
  },
];

describe("parseExploreUrlState", () => {
  it("reads place, filters, and map position", () => {
    const state = parseExploreUrlState({
      lat: "26.1",
      lng: "-80.2",
      z: "11",
      cat: "park,cafe",
      status: "ask_first",
      place: "cafe-munch",
      q: "munch",
      layer: "needs_verification",
    });

    expect(state.lat).toBeCloseTo(26.1);
    expect(state.lng).toBeCloseTo(-80.2);
    expect(state.zoom).toBe(11);
    expect(state.selectedSlug).toBe("cafe-munch");
    expect(state.filters.categories).toEqual(["park", "cafe"]);
    expect(state.filters.dogStatuses).toEqual(["ask_first"]);
    expect(state.filters.query).toBe("munch");
    expect(state.filters.layer).toBe("needs_verification");
  });

  it("serializes selected place and omits defaults", () => {
    const qs = exploreStateToSearchString({
      ...DEFAULT_EXPLORE_STATE,
      selectedSlug: "red-reef",
      filters: {
        ...DEFAULT_EXPLORE_STATE.filters,
        categories: ["park"],
      },
    });
    expect(qs).toContain("place=red-reef");
    expect(qs).toContain("cat=park");
  });
});

describe("filterPlaces", () => {
  it("filters by category and dog status", () => {
    const result = filterPlaces(sample, {
      categories: ["park"],
      dogStatuses: ["dogs_ok_outdoors"],
      layer: "all",
      query: "",
    });
    expect(result.map((p) => p.slug)).toEqual(["red-reef"]);
  });

  it("filters needs_verification layer", () => {
    const result = filterPlaces(sample, {
      categories: [],
      dogStatuses: [],
      layer: "needs_verification",
      query: "",
    });
    expect(result.map((p) => p.slug)).toEqual(["cafe-munch"]);
  });

  it("filters saved layer by id set", () => {
    const result = filterPlaces(
      sample,
      { categories: [], dogStatuses: [], layer: "saved", query: "" },
      { savedPlaceIds: new Set(["2"]) },
    );
    expect(result.map((p) => p.slug)).toEqual(["cafe-munch"]);
  });
});
