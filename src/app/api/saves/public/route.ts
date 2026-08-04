import { NextResponse } from "next/server";
import { logServerError, publicApiError } from "@/lib/api-errors";
import { fromDbSaveStatus } from "@/lib/mvp/taxonomy";
import { isSupabaseConfigured } from "@/lib/utils";

/** Other people's public pins in a bbox (for map overlay). Never returns private notes. */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ pins: [] });
  }

  const sp = new URL(request.url).searchParams;
  const minLng = Number(sp.get("minLng"));
  const minLat = Number(sp.get("minLat"));
  const maxLng = Number(sp.get("maxLng"));
  const maxLat = Number(sp.get("maxLat"));

  if ([minLng, minLat, maxLng, maxLat].some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: "bbox required" }, { status: 400 });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_public_saved_places", {
      p_min_lng: minLng,
      p_min_lat: minLat,
      p_max_lng: maxLng,
      p_max_lat: maxLat,
      p_limit: 200,
    });

    if (error) {
      logServerError("saves.public", error);
      return NextResponse.json(
        { error: publicApiError(error, "Could not load public places."), pins: [] },
        { status: 400 },
      );
    }

    const pins = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      saveId: String(row.save_id),
      placeId: String(row.place_id),
      slug: String(row.place_slug),
      name: String(row.place_name),
      category: String(row.category ?? "other"),
      lat: Number(row.lat),
      lng: Number(row.lng),
      city: (row.city as string | null) ?? null,
      address: (row.address_line1 as string | null) ?? null,
      status: fromDbSaveStatus(String(row.status)),
      dogBadges: (row.dog_badges as string[]) ?? [],
      savedBy: {
        handle: String(row.handle ?? "someone"),
        displayName: String(row.display_name ?? row.handle ?? "Someone"),
      },
    }));

    return NextResponse.json({ ok: true, pins });
  } catch (err) {
    logServerError("saves.public", err);
    return NextResponse.json({ pins: [] });
  }
}
