import { describe, expect, it } from "vitest";
import {
  discoveryErrorFromHttp,
  ProviderHttpError,
  userMessageForDiscoveryError,
} from "@/lib/discovery/errors";
import { toCandidate } from "@/lib/places/providers/foursquare";
import { renderedPoisToCandidates } from "@/lib/discovery/maptiler-fallback";

describe("discoveryErrorFromHttp", () => {
  it("maps 401 to unauthorized", () => {
    const err = discoveryErrorFromHttp(
      new ProviderHttpError({
        status: 401,
        provider: "foursquare",
        endpoint: "/places/search",
        bodySnippet: "unauthorized",
      }),
    );
    expect(err.code).toBe("PROVIDER_UNAUTHORIZED");
    expect(err.retryable).toBe(false);
  });

  it("maps 429 to rate limited", () => {
    const err = discoveryErrorFromHttp(
      new ProviderHttpError({
        status: 429,
        provider: "foursquare",
        endpoint: "/places/search",
        bodySnippet: "slow down",
      }),
    );
    expect(err.code).toBe("PROVIDER_RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("keeps friendly copy for unavailable", () => {
    const msg = userMessageForDiscoveryError({
      code: "PROVIDER_UNAVAILABLE",
      message: "We couldn’t reach place discovery right now. Try again or create a custom place.",
      retryable: true,
    });
    expect(msg).toMatch(/couldn’t reach place discovery/i);
  });
});

describe("toCandidate normalization", () => {
  it("maps unknown categories to other instead of discarding", () => {
    const c = toCandidate({
      fsq_place_id: "abc",
      name: "Mystery Spot",
      latitude: 46.59,
      longitude: 7.9,
      categories: [{ name: "Weird Niche Venue" }],
      location: { locality: "Lauterbrunnen", address: "1 Main" },
      distance: 40,
    });
    expect(c).not.toBeNull();
    expect(c!.category).toBe("other");
    expect(c!.sourceCategory).toBe("Weird Niche Venue");
  });
});

describe("renderedPoisToCandidates", () => {
  it("filters by radius and dedupes", () => {
    const out = renderedPoisToCandidates(
      [
        { name: "Hotel Silberhorn", lat: 46.593, lng: 7.908, subclass: "hotel" },
        { name: "Hotel Silberhorn", lat: 46.59301, lng: 7.90801, subclass: "hotel" },
        { name: "Far Away Cafe", lat: 47.0, lng: 8.0, subclass: "cafe" },
      ],
      { lat: 46.593, lng: 7.908 },
      400,
    );
    expect(out).toHaveLength(1);
    expect(out[0].provider).toBe("maptiler");
    expect(out[0].category).toBe("hotel");
  });
});
