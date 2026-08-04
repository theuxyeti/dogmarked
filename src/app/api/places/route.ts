import { NextResponse } from "next/server";
import { DEFAULT_BBOX, getPlacesInBbox } from "@/lib/places/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minLng = Number(searchParams.get("minLng") ?? DEFAULT_BBOX.minLng);
  const minLat = Number(searchParams.get("minLat") ?? DEFAULT_BBOX.minLat);
  const maxLng = Number(searchParams.get("maxLng") ?? DEFAULT_BBOX.maxLng);
  const maxLat = Number(searchParams.get("maxLat") ?? DEFAULT_BBOX.maxLat);

  if ([minLng, minLat, maxLng, maxLat].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "Invalid bbox" }, { status: 400 });
  }

  const places = await getPlacesInBbox({ minLng, minLat, maxLng, maxLat });
  return NextResponse.json({ places });
}
