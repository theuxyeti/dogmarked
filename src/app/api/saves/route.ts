import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/utils";

const saveSchema = z.object({
  placeId: z.string().uuid().or(z.string().min(1)),
  status: z.enum(["want_to_go", "visited", "recommended"]).default("want_to_go"),
  visibility: z.enum(["private", "link", "public"]).default("private"),
  privateNotes: z.string().max(2000).optional().nullable(),
});

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase is not configured. Private saves require NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      },
      { status: 503 },
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to view your saves." },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("user_place_saves")
    .select(
      "place_id, status, visibility, private_notes, places(id, name, slug, city, category)",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const saves = (data ?? []).flatMap((row) => {
    const placeRaw = row.places as
      | { id: string; name: string; slug: string; city: string | null; category: string | null }
      | { id: string; name: string; slug: string; city: string | null; category: string | null }[]
      | null;
    const place = Array.isArray(placeRaw) ? placeRaw[0] : placeRaw;
    if (!place) return [];
    return [
      {
        placeId: place.id,
        slug: place.slug,
        name: place.name,
        status: row.status as "want_to_go" | "visited" | "recommended",
        visibility: row.visibility as "private" | "link" | "public",
        privateNotes: row.private_notes as string | null,
        city: place.city,
        category: place.category,
      },
    ];
  });

  return NextResponse.json({ ok: true, saves });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase is not configured. Private saves require NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      },
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to save places privately." },
      { status: 401 },
    );
  }

  const { placeId, status, visibility, privateNotes } = parsed.data;
  const { error } = await supabase.from("user_place_saves").upsert(
    {
      user_id: user.id,
      place_id: placeId,
      status,
      visibility,
      private_notes: privateNotes ?? null,
    },
    { onConflict: "user_id,place_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Saved privately — this does not publish a dog policy.",
  });
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase is not configured.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
