import { NextResponse } from "next/server";
import { logServerError, publicApiError } from "@/lib/api-errors";
import { parseLatLng, requireDiscoveryUser } from "@/lib/discovery/auth";
import { decorateCandidatesWithDogmarked } from "@/lib/discovery/decorate";
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
  if (auth.error) return auth.error;

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

  if (!discovery.nearby) {
    const body: NearbyDiscoveryResponse = {
      candidates: [],
      catalogCoverage: "uncovered",
      fallbackRecommended: true,
      radiusMeters,
      discoveryAvailable: false,
      enrichment: {
        photosEnabled: enrichment.photos,
        tipsEnabled: enrichment.tips,
        premiumDetailsEnabled: enrichment.premiumDetails,
      },
      label,
    };
    return NextResponse.json({
      ...body,
      message:
        discovery.reason ??
        "Nearby discovery is temporarily unavailable. Use map places or create a custom pin.",
    });
  }

  const provider = getDiscoveryProvider();
  if (!provider) {
    return NextResponse.json(
      {
        candidates: [],
        catalogCoverage: "uncovered",
        fallbackRecommended: true,
        radiusMeters,
        discoveryAvailable: false,
        message: "FOURSQUARE_API_KEY is not configured.",
        label,
      } satisfies NearbyDiscoveryResponse & { message: string },
      { status: 503 },
    );
  }

  try {
    const started = Date.now();
    const raw = await provider.nearby({
      latitude: coords.lat,
      longitude: coords.lng,
      radiusMeters,
      limit,
    });
    const candidates = await decorateCandidatesWithDogmarked(raw, auth.user.id);

    console.info(
      JSON.stringify({
        scope: "discovery.nearby",
        durationMs: Date.now() - started,
        resultCount: candidates.length,
        radiusMeters,
        source: "foursquare",
      }),
    );

    const body: NearbyDiscoveryResponse = {
      candidates,
      catalogCoverage: "uncovered",
      fallbackRecommended: candidates.length === 0,
      radiusMeters,
      discoveryAvailable: true,
      enrichment: {
        photosEnabled: enrichment.photos,
        tipsEnabled: enrichment.tips,
        premiumDetailsEnabled: enrichment.premiumDetails,
      },
      label,
    };
    return NextResponse.json(body);
  } catch (err) {
    logServerError("discovery.nearby", err);
    return NextResponse.json(
      {
        candidates: [],
        catalogCoverage: "uncovered",
        fallbackRecommended: true,
        radiusMeters,
        discoveryAvailable: false,
        error: publicApiError(
          err instanceof Error ? err : null,
          "Nearby search failed. You can still create a custom place.",
        ),
        label,
      },
      { status: 502 },
    );
  }
}
