import { NextResponse } from "next/server";
import { z } from "zod";
import { mapOsmElements, type OsmElementLike } from "@/lib/imports/osm-mapper";
import { slugifyPlaceName, pointEwkt } from "@/lib/places/slug";
import { isSupabaseConfigured } from "@/lib/utils";

const bodySchema = z.object({
  elements: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
});

function categoryFromTags(tags: Record<string, string | undefined>) {
  if (tags.leisure === "park" || tags.leisure === "dog_park") return "park";
  if (tags.natural === "beach" || tags.leisure === "beach_resort") return "beach";
  if (tags.tourism === "hotel" || tags.tourism === "guest_house") return "hotel";
  if (tags.amenity === "cafe") return "cafe";
  if (tags.amenity === "restaurant" || tags.amenity === "fast_food") return "restaurant";
  return "other";
}

/**
 * Moderator-only: ingest Overpass elements as places + draft contributions.
 * Never writes dog_policies — promote stays server RPC.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["moderator", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Moderator access required." }, { status: 403 });
  }

  const elements = parsed.data.elements as unknown as OsmElementLike[];
  const drafts = mapOsmElements(elements).filter(
    (d) => d.lat != null && d.lng != null && d.name && d.dogStatus !== "unknown",
  );

  let placesCreated = 0;
  let contributionsCreated = 0;
  const errors: string[] = [];

  for (const draft of drafts.slice(0, 100)) {
    const lat = draft.lat!;
    const lng = draft.lng!;
    const name = draft.name!;
    const baseSlug = slugifyPlaceName(name, "south-florida");
    const slug = `${baseSlug}-${String(draft.externalKey).replace(/[^a-z0-9]+/gi, "-").slice(-12)}`.slice(0, 80);
    const tags = draft.rawTags;

    const { data: place, error: placeError } = await supabase
      .from("places")
      .upsert(
        {
          name,
          slug,
          category: categoryFromTags(tags),
          location: pointEwkt(lat, lng),
          lat,
          lng,
          country_code: "US",
          city: tags["addr:city"] ?? null,
          region: tags["addr:state"] ?? "FL",
          status: "active",
          source_type: "import",
          source_attribution: draft.sourceAttribution,
          created_by: user.id,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .maybeSingle();

    if (placeError || !place) {
      errors.push(`${name}: ${placeError?.message ?? "place insert failed"}`);
      continue;
    }
    placesCreated += 1;

    if (draft.dogStatus === "unknown") continue;

    const { error: contribError } = await supabase.from("policy_contributions").insert({
      place_id: place.id,
      user_id: user.id,
      dog_status: draft.dogStatus,
      access: draft.access,
      leash_required: draft.leashRequired,
      carrier_required: draft.carrierRequired,
      exception_text: draft.exceptionText,
      source_type: "other",
      source_url: draft.sourceUrl,
      moderation_status: "draft",
      observed_at: new Date().toISOString().slice(0, 10),
    });

    if (contribError) {
      errors.push(`${name} contribution: ${contribError.message}`);
    } else {
      contributionsCreated += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    mapped: drafts.length,
    placesCreated,
    contributionsCreated,
    errors: errors.slice(0, 10),
    message:
      "OSM drafts imported. Review in moderation, then promote via server RPC — never scraped commercial directories.",
  });
}
