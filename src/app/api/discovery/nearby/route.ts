import { NextResponse } from "next/server";
import { parseLatLng, requireDiscoveryUser } from "@/lib/discovery/auth";
import { decorateCandidatesWithDogmarked } from "@/lib/discovery/decorate";
import {
  discoveryErrorFromUnknown,
  logDiscoveryEvent,
  mergeDiscoveryErrors,
  ProviderHttpError,
  userMessageForDiscoveryError,
  type DiscoveryError,
} from "@/lib/discovery/errors";
import { fetchMapTilerNearbyPois } from "@/lib/discovery/maptiler-fallback";
import {
  clampRadiusMeters,
  DEFAULT_RADIUS_M,
  MAX_NEARBY_RESULTS,
  type NearbyDiscoveryResponse,
  type PlaceCandidate,
} from "@/lib/discovery/types";
import {
  getDiscoveryAvailability,
  getEnrichmentAvailability,
} from "@/lib/discovery/usage";
import { normalizeFoursquareApiKey } from "@/lib/discovery/fsq-key";
import { getDiscoveryProvider, getGeocodingProvider } from "@/lib/places/providers";

type FallbackResult = {
  candidates: PlaceCandidate[];
  error: DiscoveryError | null;
};

async function mapTilerFallbackCandidates(input: {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit: number;
  started: number;
}): Promise<FallbackResult> {
  try {
    const candidates = await fetchMapTilerNearbyPois({
      lat: input.lat,
      lng: input.lng,
      radiusMeters: input.radiusMeters,
      limit: input.limit,
    });
    logDiscoveryEvent({
      endpoint: "/geocoding",
      provider: "maptiler",
      httpStatus: 200,
      durationMs: Date.now() - input.started,
      radiusMeters: input.radiusMeters,
      resultCount: candidates.length,
      authenticated: true,
      budgetBlocked: false,
      errorCode: null,
      errorSnippet: candidates.length ? null : "maptiler_empty_features",
    });
    return { candidates, error: null };
  } catch (err) {
    const discoveryError = discoveryErrorFromUnknown(err);
    const httpStatus = err instanceof ProviderHttpError ? err.status : null;
    const errorSnippet =
      err instanceof ProviderHttpError
        ? err.bodySnippet
        : err instanceof Error
          ? err.message.slice(0, 200)
          : String(err).slice(0, 200);

    logDiscoveryEvent({
      endpoint: "/geocoding",
      provider: "maptiler",
      httpStatus,
      durationMs: Date.now() - input.started,
      radiusMeters: input.radiusMeters,
      resultCount: 0,
      authenticated: true,
      budgetBlocked: false,
      errorCode: discoveryError.code,
      errorSnippet,
    });
    return { candidates: [], error: discoveryError };
  }
}

function emptyFailureResponse(args: {
  discoveryError: DiscoveryError;
  radiusMeters: number;
  enrichmentMeta: NearbyDiscoveryResponse["enrichment"];
  label?: string;
  status: number;
}): NextResponse {
  return NextResponse.json(
    {
      candidates: [],
      catalogCoverage: "uncovered",
      fallbackRecommended: true,
      radiusMeters: args.radiusMeters,
      discoveryAvailable: false,
      discoveryError: args.discoveryError,
      enrichment: args.enrichmentMeta,
      label: args.label,
      message: userMessageForDiscoveryError(args.discoveryError),
    } satisfies NearbyDiscoveryResponse & { message: string },
    { status: args.status },
  );
}

async function successWithFallback(args: {
  fallback: PlaceCandidate[];
  userId: string;
  discoveryError: DiscoveryError;
  radiusMeters: number;
  enrichmentMeta: NearbyDiscoveryResponse["enrichment"];
  label?: string;
}): Promise<NextResponse> {
  const candidates = await decorateCandidatesWithDogmarked(args.fallback, args.userId);
  return NextResponse.json({
    candidates,
    catalogCoverage: "uncovered",
    fallbackRecommended: false,
    radiusMeters: args.radiusMeters,
    discoveryAvailable: true,
    usedFallback: true,
    fallbackProvider: "maptiler",
    discoveryError: args.discoveryError,
    enrichment: args.enrichmentMeta,
    label: args.label,
    message: userMessageForDiscoveryError(args.discoveryError),
  } satisfies NearbyDiscoveryResponse & { message: string });
}

export async function GET(request: Request) {
  const auth = await requireDiscoveryUser();
  if (auth.error) {
    const discoveryError: DiscoveryError = {
      code: "AUTH_REQUIRED",
      message: "Sign in to discover nearby places.",
      retryable: false,
    };
    return NextResponse.json(
      {
        candidates: [],
        catalogCoverage: "uncovered",
        fallbackRecommended: true,
        radiusMeters: DEFAULT_RADIUS_M,
        discoveryAvailable: false,
        discoveryError,
        message: userMessageForDiscoveryError(discoveryError),
      } satisfies NearbyDiscoveryResponse & { message: string },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const coords = parseLatLng(searchParams);
  if (!coords) {
    return NextResponse.json({ error: "Valid lat and lng are required." }, { status: 400 });
  }

  const radiusMeters = clampRadiusMeters(
    Number(searchParams.get("radius") ?? DEFAULT_RADIUS_M),
    true,
  );
  const limit = Math.min(
    MAX_NEARBY_RESULTS,
    Math.max(1, Number(searchParams.get("limit") ?? MAX_NEARBY_RESULTS) || MAX_NEARBY_RESULTS),
  );

  const discovery = await getDiscoveryAvailability();
  const enrichment = await getEnrichmentAvailability();

  let label: string | undefined;
  const geo = getGeocodingProvider();
  if (geo) {
    try {
      const rev = await geo.reverseGeocode({ lat: coords.lat, lng: coords.lng });
      label = rev.place?.name;
    } catch {
      /* optional */
    }
  }

  const enrichmentMeta = {
    photosEnabled: enrichment.photos,
    tipsEnabled: enrichment.tips,
    premiumDetailsEnabled: enrichment.premiumDetails,
  };

  const started = Date.now();

  if (!discovery.nearby) {
    const discoveryError: DiscoveryError = {
      code: normalizeFoursquareApiKey(process.env.FOURSQUARE_API_KEY ?? "")
        ? "DISCOVERY_LIMIT_REACHED"
        : "PROVIDER_NOT_CONFIGURED",
      message: discovery.reason ?? "Nearby discovery unavailable.",
      retryable: false,
    };
    logDiscoveryEvent({
      endpoint: "/places/search",
      provider: "foursquare",
      httpStatus: null,
      durationMs: 0,
      radiusMeters,
      resultCount: 0,
      authenticated: true,
      budgetBlocked: discoveryError.code === "DISCOVERY_LIMIT_REACHED",
      errorCode: discoveryError.code,
      errorSnippet: discovery.reason ?? null,
    });

    const fallback = await mapTilerFallbackCandidates({
      lat: coords.lat,
      lng: coords.lng,
      radiusMeters,
      limit,
      started,
    });
    if (fallback.candidates.length > 0) {
      return successWithFallback({
        fallback: fallback.candidates,
        userId: auth.user.id,
        discoveryError,
        radiusMeters,
        enrichmentMeta,
        label,
      });
    }

    return emptyFailureResponse({
      discoveryError: mergeDiscoveryErrors(discoveryError, fallback.error),
      radiusMeters,
      enrichmentMeta,
      label,
      status: 503,
    });
  }

  const provider = getDiscoveryProvider();
  if (!provider) {
    const discoveryError: DiscoveryError = {
      code: "PROVIDER_NOT_CONFIGURED",
      message: "FOURSQUARE_API_KEY is not configured.",
      retryable: false,
    };
    logDiscoveryEvent({
      endpoint: "/places/search",
      provider: "foursquare",
      httpStatus: null,
      durationMs: 0,
      radiusMeters,
      resultCount: 0,
      authenticated: true,
      budgetBlocked: false,
      errorCode: discoveryError.code,
      errorSnippet: "missing FOURSQUARE_API_KEY",
    });

    const fallback = await mapTilerFallbackCandidates({
      lat: coords.lat,
      lng: coords.lng,
      radiusMeters,
      limit,
      started,
    });
    if (fallback.candidates.length > 0) {
      return successWithFallback({
        fallback: fallback.candidates,
        userId: auth.user.id,
        discoveryError,
        radiusMeters,
        enrichmentMeta,
        label,
      });
    }

    return emptyFailureResponse({
      discoveryError: mergeDiscoveryErrors(discoveryError, fallback.error),
      radiusMeters,
      enrichmentMeta,
      label,
      status: 503,
    });
  }

  try {
    const raw = await provider.nearby({
      latitude: coords.lat,
      longitude: coords.lng,
      radiusMeters,
      limit,
    });
    let candidates = await decorateCandidatesWithDogmarked(raw, auth.user.id);
    let usedFallback = false;

    if (candidates.length === 0) {
      const fallback = await mapTilerFallbackCandidates({
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters,
        limit,
        started,
      });
      if (fallback.candidates.length > 0) {
        candidates = await decorateCandidatesWithDogmarked(
          fallback.candidates,
          auth.user.id,
        );
        usedFallback = true;
      }
    }

    const durationMs = Date.now() - started;

    logDiscoveryEvent({
      endpoint: "/places/search",
      provider: usedFallback ? "maptiler" : "foursquare",
      httpStatus: 200,
      durationMs,
      radiusMeters,
      resultCount: candidates.length,
      authenticated: true,
      budgetBlocked: false,
      errorCode: null,
      errorSnippet: usedFallback ? "fsq_empty_maptiler_fallback" : null,
    });

    const body: NearbyDiscoveryResponse = {
      candidates,
      catalogCoverage: "uncovered",
      fallbackRecommended: candidates.length === 0,
      radiusMeters,
      discoveryAvailable: true,
      usedFallback: usedFallback || undefined,
      fallbackProvider: usedFallback ? "maptiler" : undefined,
      enrichment: enrichmentMeta,
      label,
    };
    return NextResponse.json(body);
  } catch (err) {
    const discoveryError = discoveryErrorFromUnknown(err);
    const httpStatus = err instanceof ProviderHttpError ? err.status : null;
    const errorSnippet =
      err instanceof ProviderHttpError
        ? err.bodySnippet
        : err instanceof Error
          ? err.message.slice(0, 200)
          : String(err).slice(0, 200);

    logDiscoveryEvent({
      endpoint: "/places/search",
      provider: "foursquare",
      httpStatus,
      durationMs: Date.now() - started,
      radiusMeters,
      resultCount: 0,
      authenticated: true,
      budgetBlocked: false,
      errorCode: discoveryError.code,
      errorSnippet,
    });

    const fallback = await mapTilerFallbackCandidates({
      lat: coords.lat,
      lng: coords.lng,
      radiusMeters,
      limit,
      started,
    });
    if (fallback.candidates.length > 0) {
      const candidates = await decorateCandidatesWithDogmarked(
        fallback.candidates,
        auth.user.id,
      );
      logDiscoveryEvent({
        endpoint: "/places/search",
        provider: "maptiler",
        httpStatus: 200,
        durationMs: Date.now() - started,
        radiusMeters,
        resultCount: candidates.length,
        authenticated: true,
        budgetBlocked: false,
        errorCode: discoveryError.code,
        errorSnippet: "fsq_failed_maptiler_fallback",
      });
      return NextResponse.json({
        candidates,
        catalogCoverage: "uncovered",
        fallbackRecommended: false,
        radiusMeters,
        discoveryAvailable: true,
        usedFallback: true,
        fallbackProvider: "maptiler",
        discoveryError,
        enrichment: enrichmentMeta,
        label,
        message: userMessageForDiscoveryError(discoveryError),
      } satisfies NearbyDiscoveryResponse & { message: string });
    }

    const merged = mergeDiscoveryErrors(discoveryError, fallback.error);
    return emptyFailureResponse({
      discoveryError: merged,
      radiusMeters,
      enrichmentMeta,
      label,
      status: 502,
    });
  }
}
