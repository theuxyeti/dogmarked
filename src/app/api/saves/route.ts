import { NextResponse } from "next/server";
import { z } from "zod";
import { publicApiError, logServerError } from "@/lib/api-errors";
import {
  DOG_BADGE_IDS,
  fromDbSaveStatus,
  toDbSaveStatus,
  type DogBadgeId,
  type MvpSaveStatus,
} from "@/lib/mvp/taxonomy";
import { isSupabaseConfigured } from "@/lib/utils";

const saveSchema = z.object({
  placeId: z.string().uuid().or(z.string().min(1)),
  status: z.enum(["want_to_go", "been_there", "visited"]).default("want_to_go"),
  visibility: z.enum(["private", "public"]).default("private"),
  privateNotes: z.string().max(2000).optional().nullable(),
  dogBadges: z.array(z.string()).max(20).optional().default([]),
  category: z.string().optional(),
});

function sanitizeBadges(raw: string[] | undefined): DogBadgeId[] {
  return (raw ?? []).filter((b): b is DogBadgeId => DOG_BADGE_IDS.has(b as DogBadgeId));
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Your places aren’t available yet. Try again later." },
      { status: 503 },
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to see your places." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_place_saves")
    .select(
      "place_id, status, visibility, private_notes, dog_badges, places(id, name, slug, city, category, lat, lng, address_line1, website)",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    logServerError("saves.GET", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not load your places.") },
      { status: 400 },
    );
  }

  const saves = (data ?? []).flatMap((row) => {
    const placeRaw = row.places as Record<string, unknown> | Record<string, unknown>[] | null;
    const place = Array.isArray(placeRaw) ? placeRaw[0] : placeRaw;
    if (!place) return [];
    return [
      {
        placeId: String(place.id),
        slug: String(place.slug),
        name: String(place.name),
        status: fromDbSaveStatus(String(row.status)),
        visibility: row.visibility === "public" ? "public" : "private",
        privateNotes: (row.private_notes as string | null) ?? null,
        dogBadges: sanitizeBadges((row.dog_badges as string[]) ?? []),
        city: (place.city as string | null) ?? null,
        category: (place.category as string | null) ?? "other",
        lat: Number(place.lat),
        lng: Number(place.lng),
        address: (place.address_line1 as string | null) ?? null,
        website: (place.website as string | null) ?? null,
      },
    ];
  });

  return NextResponse.json({ ok: true, saves });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Saving requires a connected project." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the place details and try again." }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to save places." }, { status: 401 });
  }

  const mvpStatus: MvpSaveStatus =
    parsed.data.status === "been_there" || parsed.data.status === "visited"
      ? "been_there"
      : "want_to_go";
  const dogBadges = sanitizeBadges(parsed.data.dogBadges);

  const { error } = await supabase.from("user_place_saves").upsert(
    {
      user_id: user.id,
      place_id: parsed.data.placeId,
      status: toDbSaveStatus(mvpStatus),
      visibility: parsed.data.visibility,
      private_notes: parsed.data.privateNotes ?? null,
      dog_badges: dogBadges,
    },
    { onConflict: "user_id,place_id" },
  );

  if (error) {
    logServerError("saves.POST", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not save that place.") },
      { status: 400 },
    );
  }

  // Optional: update place category when saver sets one
  if (parsed.data.category) {
    await supabase
      .from("places")
      .update({ category: parsed.data.category, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.placeId)
      .eq("created_by", user.id);
  }

  return NextResponse.json({
    ok: true,
    message: "Saved to your map.",
  });
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Could not update your places right now." },
      { status: 503 },
    );
  }

  const placeId = new URL(request.url).searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { error } = await supabase
    .from("user_place_saves")
    .delete()
    .eq("user_id", user.id)
    .eq("place_id", placeId);

  if (error) {
    logServerError("saves.DELETE", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not remove that place.") },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
