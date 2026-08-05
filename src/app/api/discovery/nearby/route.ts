import { NextResponse } from "next/server";
import { parseLatLng, requireDiscoveryUser } from "@/lib/discovery/auth";
import { decorateCandidatesWithDogmarked } from "@/lib/discovery/decorate";
import {
  discoveryErrorFromUnknown,
  logDiscoveryEvent,
  ProviderHttpError,
  userMessageForDiscoveryError,
  type DiscoveryError,
} from "@/lib/discovery/errors";
import {
  clampRadiusMeters,
  DEFAULT_RADIUS_M,
  MAX_NEARBY_RESULTS,
  type NearbyDiscoveryResponse,
} from "@/lib/discovery/types";
import {
  getDiscoveryAvailability,
  getEnrichmentAvailability,
} from "@/lib/discovery/usage";
import { getDiscoveryProvider, getGeocodingProvider } from "@/lib/places/providers";

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

  if (!discovery.nearby) {
    const discoveryError: DiscoveryError = {
      code: process.env.FOURSQUARE_API_KEY?.trim()
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
    return NextResponse.json({
      candidates: [],
      catalogCoverage: "uncovered",
      fallbackRecommended: true,
      radiusMeters,
      discoveryAvailable: false,
      discoveryError,
      enrichment: enrichmentMeta,
      label,
      message: userMessageForDiscoveryError(discoveryError),
    } satisfies NearbyDiscoveryResponse & { message: string });
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
    return NextResponse.json(
      {
        candidates: [],
        catalogCoverage: "uncovered",
        fallbackRecommended: true,
        radiusMeters,
        discoveryAvailable: false,
        discoveryError,
        enrichment: enrichmentMeta,
        label,
        message: userMessageForDiscoveryError(discoveryError),
      } satisfies NearbyDiscoveryResponse & { message: string },
      { status: 503 },
    );
  }

  const started = Date.now();
  try {
    const raw = await provider.nearby({
      latitude: coords.lat,
      longitude: coords.lng,
      radiusMeters,
      limit,
    });
    const candidates = await decorateCandidatesWithDogmarked(raw, auth.user.id);
    const durationMs = Date.now() - started;

    logDiscoveryEvent({
      endpoint: "/places/search",
      provider: "foursquare",
      httpStatus: 200,
      durationMs,
      radiusMeters,
      resultCount: candidates.length,
      authenticated: true,
      budgetBlocked: false,
      errorCode: null,
      errorSnippet: null,
    });

    const body: NearbyDiscoveryResponse = {
      candidates,
      catalogCoverage: "uncovered",
      fallbackRecommended: candidates.length === 0,
      radiusMeters,
      discoveryAvailable: true,
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

    return NextResponse.json(
      {
        candidates: [],
        catalogCoverage: "uncovered",
        fallbackRecommended: true,
        radiusMeters,
        discoveryAvailable: false,
        discoveryError,
        enrichment: enrichmentMeta,
        label,
        message: userMessageForDiscoveryError(discoveryError),
      } satisfies NearbyDiscoveryResponse & { message: string },
      { status: 502 },
    );
  }
}
