import { NextResponse } from "next/server";
import { logServerError, publicApiError } from "@/lib/api-errors";
import { requireDiscoveryUser } from "@/lib/discovery/auth";
import { getEnrichmentAvailability } from "@/lib/discovery/usage";
import { getDiscoveryProvider } from "@/lib/places/providers";

type Ctx = { params: Promise<{ externalId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireDiscoveryUser();
  if (auth.error) return auth.error;

  const { externalId: rawId } = await ctx.params;
  const externalId = decodeURIComponent(rawId ?? "").trim();
  if (!externalId || externalId.length > 128) {
    return NextResponse.json({ error: "Invalid place id." }, { status: 400 });
  }

  const enrichment = await getEnrichmentAvailability();
  if (!enrichment.photos) {
    return NextResponse.json({ photos: [], enrichmentDisabled: true });
  }

  const provider = getDiscoveryProvider();
  if (!provider) {
    return NextResponse.json({ error: "Provider not configured." }, { status: 503 });
  }

  try {
    const photos = await provider.photos(externalId, 8);
    return NextResponse.json({ photos });
  } catch (err) {
    logServerError("discovery.photos", err);
    return NextResponse.json(
      {
        photos: [],
        error: publicApiError(
          err instanceof Error ? err : null,
          "Could not load photos.",
        ),
      },
      { status: 200 },
    );
  }
}
