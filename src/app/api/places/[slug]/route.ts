import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";
import { getPlaceBySlug } from "@/lib/places/queries";
import { isSupabaseConfigured } from "@/lib/utils";

const patchSchema = z.object({
  status: z.enum(["active", "closed", "duplicate_merged"]),
});

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Could not update that place right now." },
      { status: 503 },
    );
  }

  const { slug } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid place status." }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("places")
    .update({ status: parsed.data.status })
    .eq("slug", slug)
    .select("id, slug, status")
    .maybeSingle();

  if (error || !data) {
    if (error) logServerError("places.PATCH", error);
    return NextResponse.json(
      {
        error: publicApiError(
          error,
          "Could not update place. You may need to own it or be a moderator.",
        ),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    place: data,
    message:
      parsed.data.status === "closed"
        ? "Place marked closed. It stays readable for history but Explore active lists hide it."
        : `Place status set to ${parsed.data.status}.`,
  });
}
