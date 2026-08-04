import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/utils";

const bodySchema = z.object({
  survivorPlaceId: z.string().uuid(),
  loserPlaceId: z.string().uuid(),
  note: z.string().trim().max(1000).optional().nullable(),
});

async function requireModerator() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["moderator", "admin"].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Moderator access required." }, { status: 403 }),
    };
  }
  return { supabase };
}

/** List nearby same-name active places (moderator). */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "25");
  const gate = await requireModerator();
  if ("error" in gate && gate.error) return gate.error;

  const { data, error } = await gate.supabase!.rpc("list_duplicate_place_candidates", {
    p_limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 25,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Candidate query failed. Apply migration 009?" },
      { status: 500 },
    );
  }

  const candidates = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    placeAId: String(row.place_a_id),
    placeASlug: String(row.place_a_slug),
    placeAName: String(row.place_a_name),
    placeBId: String(row.place_b_id),
    placeBSlug: String(row.place_b_slug),
    placeBName: String(row.place_b_name),
    distanceM: Number(row.distance_m) || 0,
  }));

  return NextResponse.json({ ok: true, candidates });
}

/** Merge loser into survivor (moderator). */
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

  if (parsed.data.survivorPlaceId === parsed.data.loserPlaceId) {
    return NextResponse.json(
      { error: "Survivor and loser must be different places." },
      { status: 400 },
    );
  }

  const gate = await requireModerator();
  if ("error" in gate && gate.error) return gate.error;

  const { data, error } = await gate.supabase!.rpc("merge_places", {
    p_survivor_place_id: parsed.data.survivorPlaceId,
    p_loser_place_id: parsed.data.loserPlaceId,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Merge failed. Apply migration 009?" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, result: data });
}
