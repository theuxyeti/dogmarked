import { NextResponse } from "next/server";
import { getGeocodingProvider } from "@/lib/geocoding";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  const provider = getGeocodingProvider();

  try {
    if (lat && lng) {
      const result = await provider.reverse(Number(lat), Number(lng));
      return NextResponse.json({ results: result ? [result] : [] });
    }

    if (!q) {
      return NextResponse.json({ error: "q or lat/lng required" }, { status: 400 });
    }

    const results = await provider.search(q);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Geocoding failed" },
      { status: 502 },
    );
  }
}
