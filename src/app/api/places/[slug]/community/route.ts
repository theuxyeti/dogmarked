import { NextResponse } from "next/server";
import { logServerError, publicApiError } from "@/lib/api-errors";
import { fromDbSaveStatus } from "@/lib/mvp/taxonomy";

type Ctx = { params: Promise<{ slug: string }> };

/** Public community notes for a canonical place — never private-visibility saves. */
export async function GET(_request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "Missing place." }, { status: 400 });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data: place, error: placeErr } = await supabase
      .from("places")
      .select("id, slug, name")
      .eq("slug", slug)
      .maybeSingle();

    if (placeErr || !place) {
      return NextResponse.json({ error: "Place not found." }, { status: 404 });
    }

    const { data: saves, error } = await supabase
      .from("user_place_saves")
      .select("status, private_notes, dog_badges, updated_at, user_id")
      .eq("place_id", place.id)
      .eq("visibility", "public")
      .order("updated_at", { ascending: false })
      .limit(40);

    if (error) {
      logServerError("places.community", error);
      return NextResponse.json(
        { error: publicApiError(error, "Could not load community notes.") },
        { status: 400 },
      );
    }

    const userIds = [...new Set((saves ?? []).map((s) => String(s.user_id)))];
    const profileById = new Map<string, { handle: string; display_name: string | null }>();
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileById.set(String(p.id), {
          handle: String(p.handle ?? "user"),
          display_name: p.display_name ? String(p.display_name) : null,
        });
      }
    }

    const notes = (saves ?? []).map((s) => {
      const profile = profileById.get(String(s.user_id));
      return {
        handle: profile?.handle ?? "user",
        displayName: profile?.display_name ?? profile?.handle ?? "User",
        status: fromDbSaveStatus(String(s.status)),
        note: s.private_notes ?? null,
        dogBadges: (s.dog_badges as string[]) ?? [],
        updatedAt: s.updated_at,
      };
    });

    return NextResponse.json({
      placeId: place.id,
      slug: place.slug,
      contributorCount: notes.length,
      notes,
    });
  } catch (err) {
    logServerError("places.community", err);
    return NextResponse.json(
      { error: publicApiError(err instanceof Error ? err : null, "Could not load notes.") },
      { status: 500 },
    );
  }
}
