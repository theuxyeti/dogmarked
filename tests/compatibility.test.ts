import { describe, expect, it } from "vitest";
import { computeCompatibility } from "@/lib/compatibility";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { DogPolicy, DogProfile } from "@/lib/types";

const sugarAndMunch: DogProfile[] = DEFAULT_DOG_PROFILES.map((d) => ({
  ...d,
}));

function basePolicy(overrides: Partial<DogPolicy> = {}): DogPolicy {
  return {
    placeId: "test-place",
    dogStatus: "dogs_welcome",
    access: ["outdoors"],
    maxDogs: null,
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
    sourceType: "official",
    sourceUrl: null,
    confidence: 0.8,
    lastVerifiedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeCompatibility", () => {
  it("Sugar + Munch vs max_dogs=1 → ask_first", () => {
    expect(sugarAndMunch).toHaveLength(2);
    expect(sugarAndMunch.map((d) => d.name)).toEqual(["Sugar", "Munch"]);

    const result = computeCompatibility(
      sugarAndMunch,
      basePolicy({ maxDogs: 1 }),
    );

    expect(result.verdict).toBe("ask_first");
    expect(result.label).toBe("Ask first");
    expect(result.reasons.some((r) => /ask before arriving/i.test(r))).toBe(
      true,
    );
  });

  it("single dog within max_dogs=1 → good_match", () => {
    const result = computeCompatibility(
      [sugarAndMunch[0]!],
      basePolicy({ maxDogs: 1 }),
    );
    expect(result.verdict).toBe("good_match");
  });

  it("combined weight over limit → not_a_match", () => {
    const result = computeCompatibility(
      sugarAndMunch,
      basePolicy({ maxCombinedWeightKg: 20 }),
    );
    expect(result.verdict).toBe("not_a_match");
  });

  it("carrier required when Munch does not travel in carrier → ask_first", () => {
    const result = computeCompatibility(
      sugarAndMunch,
      basePolicy({ carrierRequired: true }),
    );
    expect(result.verdict).toBe("ask_first");
    expect(result.reasons.some((r) => /carrier required/i.test(r))).toBe(true);
  });

  it("no_dogs status → not_a_match", () => {
    const result = computeCompatibility(
      sugarAndMunch,
      basePolicy({ dogStatus: "no_dogs" }),
    );
    expect(result.verdict).toBe("not_a_match");
  });
});
