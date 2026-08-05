import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";

const patchSchema = z.object({
  showMyPlaces: z.boolean().optional(),
  showCommunity: z.boolean().optional(),
});

export async function GET() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      showMyPlaces: true,
      showCommunity: false,
      authenticated: false,
    });
  }

  const { data } = await supabase
    .from("user_map_preferences")
    .select("show_my_places, show_community")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    showMyPlaces: data?.show_my_places ?? true,
    showCommunity: data?.show_community ?? false,
    authenticated: true,
  });
}

export async function PATCH(request: Request) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
  }

  const row = {
    user_id: user.id,
    show_my_places: parsed.data.showMyPlaces ?? true,
    show_community: parsed.data.showCommunity ?? false,
    updated_at: new Date().toISOString(),
  };

  // Read-merge for partial updates
  const { data: existing } = await supabase
    .from("user_map_preferences")
    .select("show_my_places, show_community")
    .eq("user_id", user.id)
    .maybeSingle();

  const merged = {
    user_id: user.id,
    show_my_places:
      parsed.data.showMyPlaces ?? existing?.show_my_places ?? true,
    show_community:
      parsed.data.showCommunity ?? existing?.show_community ?? false,
    updated_at: row.updated_at,
  };

  const { error } = await supabase.from("user_map_preferences").upsert(merged, {
    onConflict: "user_id",
  });

  if (error) {
    logServerError("map-preferences.PATCH", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not save map preferences.") },
      { status: 400 },
    );
  }

  return NextResponse.json({
    showMyPlaces: merged.show_my_places,
    showCommunity: merged.show_community,
  });
}
