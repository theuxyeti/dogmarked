import { NextResponse } from "next/server";
import { getPlaceBySlug } from "@/lib/places/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const place = await getPlaceBySlug(slug);
  if (!place) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }
  return NextResponse.json({ place });
}
