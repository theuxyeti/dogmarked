import { describe, expect, it } from "vitest";
import {
  DeterministicNoteParser,
  applySuggestionPatches,
  parseNoteToSuggestions,
} from "@/lib/policy/note-parse";

const parser = new DeterministicNoteParser();

describe("DeterministicNoteParser", () => {
  it("suggests maxDogs from 'two dogs'", () => {
    const { suggestions } = parser.parse("We stayed with two dogs");
    const max = suggestions.find((s) => s.field === "maxDogs");
    expect(max?.patch.maxDogs).toBe(2);
    expect(max?.matchedText.toLowerCase()).toContain("two dogs");
  });

  it("suggests fee from euro stay phrasing", () => {
    const { suggestions } = parser.parse("€40 for the stay");
    const fee = suggestions.find((s) => s.field === "fee");
    expect(fee?.patch.fee).toEqual(
      expect.objectContaining({
        amount: 40,
        currency: "EUR",
        basis: "per_stay",
      }),
    );
  });

  it("suggests indoor dining denial without auto-publishing", () => {
    const result = parser.parse("not permitted in the dining room");
    const area = result.suggestions.find((s) => s.field === "areas");
    expect(area?.patch.areas?.indoorDining).toBe(false);
    expect(area?.patch.overallStatus).toBe("restricted");
    // Suggestions only — caller decides whether to save
    expect(result.suggestions.every((s) => s.patch)).toBe(true);
  });

  it("suggests leash required", () => {
    const { suggestions } = parser.parse("Leash required on the grounds");
    expect(
      suggestions.some((s) => s.patch.rules?.leashRequired === true),
    ).toBe(true);
  });

  it("suggests dogs welcome as confirmed", () => {
    const { suggestions } = parser.parse("Dogs welcome at the cafe");
    const status = suggestions.find((s) => s.field === "overallStatus");
    expect(status?.patch.overallStatus).toBe("confirmed");
  });

  it("suggests not_allowed for global ban phrasing", () => {
    const { suggestions } = parser.parse("Dogs not allowed");
    const status = suggestions.find((s) => s.field === "overallStatus");
    expect(status?.patch.overallStatus).toBe("not_allowed");
  });

  it("suggests weight limit in lb", () => {
    const { suggestions } = parser.parse("Up to 25 lb dogs only");
    const w = suggestions.find((s) => s.field === "weightLimitLb");
    expect(w?.patch.weightLimitLb).toBe(25);
  });

  it("suggests USD per-night fee", () => {
    const { suggestions } = parser.parse("pet fee of $25 per night");
    const fee = suggestions.find((s) => s.field === "fee");
    expect(fee?.patch.fee).toEqual(
      expect.objectContaining({
        amount: 25,
        currency: "USD",
        basis: "per_night",
      }),
    );
  });

  it("returns empty suggestions for blank notes", () => {
    expect(parser.parse("   ").suggestions).toEqual([]);
  });

  it("parseNoteToSuggestions uses the default parser", () => {
    const result = parseNoteToSuggestions("max 3 dogs, leash required");
    expect(result.suggestions.some((s) => s.patch.maxDogs === 3)).toBe(true);
    expect(
      result.suggestions.some((s) => s.patch.rules?.leashRequired === true),
    ).toBe(true);
  });
});

describe("applySuggestionPatches", () => {
  it("merges accepted suggestions without inventing publish state", () => {
    const { suggestions } = parser.parse(
      "two dogs, €40 for the stay, not permitted in the dining room",
    );
    const merged = applySuggestionPatches({}, suggestions);
    expect(merged.maxDogs).toBe(2);
    expect(merged.fee?.amount).toBe(40);
    expect(merged.areas?.indoorDining).toBe(false);
  });
});
