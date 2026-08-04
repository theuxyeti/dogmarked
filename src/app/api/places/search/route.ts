import { NextResponse } from "next/server";
import { logServerError, publicApiError } from "@/lib/api-errors";
import { getPlaceProvider } from "@/lib/places/providers";

/**
 * Interactive place search — no DB insert.
 * ≥3 chars; optional viewport bias via bbox / proximity.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const kind = searchParams.get("kind"); // place | destination | all
  const bboxRaw = searchParams.get("bbox");

  const provider = getPlaceProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "Place search needs NEXT_PUBLIC_MAPTILER_KEY." },
      { status: 503 },
    );
  }

  try {
    if (lat && lng && !q) {
      const result = await provider.reverseGeocode({
        lat: Number(lat),
        lng: Number(lng),
      });
      return NextResponse.json({
        place: result.place,
        nearby: result.nearby,
        attribution: result.place?.attribution ?? null,
      });
    }

    if (q.length < 3) {
      return NextResponse.json({ results: [] });
    }

    let bbox: [number, number, number, number] | undefined;
    if (bboxRaw) {
      const parts = bboxRaw.split(",").map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        bbox = parts as [number, number, number, number];
      }
    }

    const kinds =
      kind === "place" || kind === "destination"
        ? ([kind] as Array<"place" | "destination">)
        : undefined;

    const results = await provider.searchPlaces({
      query: q,
      bbox,
      proximity:
        lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined,
      kinds,
      limit: 8,
    });

    return NextResponse.json({ results });
  } catch (err) {
    logServerError("places.search", err);
    return NextResponse.json(
      {
        error: publicApiError(
          err instanceof Error ? err : null,
          "Place search failed. Try again.",
        ),
      },
      { status: 502 },
    );
  }
}
