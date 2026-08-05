import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoveryErrorFromHttp,
  discoveryErrorFromUnknown,
  mergeDiscoveryErrors,
  ProviderHttpError,
  userMessageForDiscoveryError,
} from "@/lib/discovery/errors";
import { normalizeFoursquareApiKey } from "@/lib/discovery/fsq-key";
import {
  fetchMapTilerNearbyPois,
  MAPTILER_GEOCODING_MAX_LIMIT,
  renderedPoisToCandidates,
} from "@/lib/discovery/maptiler-fallback";
import { toCandidate } from "@/lib/places/providers/foursquare";

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

  it("maps 402 payment required to unauthorized", () => {
    const err = discoveryErrorFromHttp(
      new ProviderHttpError({
        status: 402,
        provider: "foursquare",
        endpoint: "/places/search",
        bodySnippet: "payment required",
      }),
    );
    expect(err.code).toBe("PROVIDER_UNAUTHORIZED");
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

  it("maps maptiler failures to MAPTILER_FAILED", () => {
    const err = discoveryErrorFromHttp(
      new ProviderHttpError({
        status: 400,
        provider: "maptiler",
        endpoint: "/geocoding/7.9,46.5",
        bodySnippet: "Invalid parameters",
      }),
    );
    expect(err.code).toBe("MAPTILER_FAILED");
  });

  it("maps network TypeError to PROVIDER_UNAVAILABLE", () => {
    const err = discoveryErrorFromUnknown(new TypeError("fetch failed"));
    expect(err.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("keeps friendly copy with actionable code", () => {
    const msg = userMessageForDiscoveryError({
      code: "PROVIDER_UNAVAILABLE",
      message: "We couldn’t reach place discovery right now. Try again or create a custom place.",
      retryable: true,
    });
    expect(msg).toMatch(/couldn’t reach place discovery/i);
    expect(msg).toContain("PROVIDER_UNAVAILABLE");
  });

  it("surfaces unauthorized with FOURSQUARE hint", () => {
    const msg = userMessageForDiscoveryError({
      code: "PROVIDER_UNAUTHORIZED",
      message: "auth failed",
      retryable: false,
    });
    expect(msg).toContain("PROVIDER_UNAUTHORIZED");
    expect(msg).toMatch(/FOURSQUARE_API_KEY/i);
  });

  it("merges maptiler failure into primary error message", () => {
    const merged = mergeDiscoveryErrors(
      {
        code: "PROVIDER_UNAUTHORIZED",
        message: "Place discovery could not authenticate with the provider.",
        retryable: false,
      },
      {
        code: "MAPTILER_FAILED",
        message: "Map place fallback failed.",
        retryable: true,
      },
    );
    expect(merged.code).toBe("PROVIDER_UNAUTHORIZED");
    expect(merged.message).toMatch(/MAPTILER_FAILED/);
  });
});

describe("normalizeFoursquareApiKey", () => {
  it("strips Bearer prefix and quotes", () => {
    expect(normalizeFoursquareApiKey("  Bearer abc123  ")).toBe("abc123");
    expect(normalizeFoursquareApiKey('"abc123"')).toBe("abc123");
    expect(normalizeFoursquareApiKey("'abc123'")).toBe("abc123");
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

  it("accepts legacy fsq_id + geocodes", () => {
    const c = toCandidate({
      fsq_id: "legacy-1",
      name: "Hotel",
      geocodes: { main: { latitude: 46.59, longitude: 7.91 } },
      categories: [{ id: 19014, name: "Hotel" }],
    });
    expect(c).not.toBeNull();
    expect(c!.externalId).toBe("legacy-1");
    expect(c!.latitude).toBe(46.59);
    expect(c!.category).toBe("hotel");
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

describe("fetchMapTilerNearbyPois", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("caps geocoding limit at MapTiler max (10) even when caller asks for 15", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("types=poi");
      const limit = new URL(url).searchParams.get("limit");
      expect(Number(limit)).toBeLessThanOrEqual(MAPTILER_GEOCODING_MAX_LIMIT);
      expect(Number(limit)).toBe(10);
      return new Response(
        JSON.stringify({
          features: [
            {
              id: "poi.1",
              text: "Hotel Silberhorn",
              place_name: "Hotel Silberhorn, Lauterbrunnen",
              center: [7.908, 46.593],
              place_type: ["poi"],
              properties: { category: "hotel" },
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchMapTilerNearbyPois({
      lat: 46.593,
      lng: 7.908,
      radiusMeters: 400,
      limit: 15,
      apiKey: "test-key",
    });

    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Hotel Silberhorn");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("throws ProviderHttpError with status/body when MapTiler returns 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid parameters", { status: 400 })),
    );

    await expect(
      fetchMapTilerNearbyPois({
        lat: 46.593,
        lng: 7.908,
        radiusMeters: 400,
        limit: 15,
        apiKey: "test-key",
      }),
    ).rejects.toMatchObject({
      name: "ProviderHttpError",
      status: 400,
      provider: "maptiler",
      bodySnippet: expect.stringContaining("Invalid parameters"),
    });
  });
});
