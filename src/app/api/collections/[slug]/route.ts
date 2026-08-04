import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOwnedCollectionBySlug,
  getPlacesForCollection,
} from "@/lib/collections/server";
import { isSupabaseConfigured } from "@/lib/utils";

const patchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  visibility: z.enum(["private", "link", "public"]).optional(),
});

const addPlaceSchema = z.object({
  placeId: z.string().uuid(),
  note: z.string().trim().max(500).optional().nullable(),
});

async function requireUser() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { slug } = await context.params;
  const { user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const collection = await getOwnedCollectionBySlug(user.id, slug);
  if (!collection) {
    return NextResponse.json({ error: "Collection not found." }, { status: 404 });
  }

  const places = await getPlacesForCollection(collection.placeIds);
  return NextResponse.json({ ok: true, collection, places });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility;

  const { data, error } = await supabase
    .from("collections")
    .update(updates)
    .eq("owner_id", user.id)
    .eq("slug", slug)
    .select("id, slug, title, description, visibility")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    collection: data,
    message:
      parsed.data.visibility === "private"
        ? "Collection is private."
        : parsed.data.visibility
          ? `Collection visibility set to ${parsed.data.visibility}.`
          : "Collection updated.",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { slug } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addPlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const collection = await getOwnedCollectionBySlug(user.id, slug);
  if (!collection) {
    return NextResponse.json({ error: "Collection not found." }, { status: 404 });
  }

  const { error } = await supabase.from("collection_places").upsert(
    {
      collection_id: collection.id,
      place_id: parsed.data.placeId,
      note: parsed.data.note ?? null,
      sort_order: collection.placeIds.length,
    },
    { onConflict: "collection_id,place_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Place added to collection." });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const collection = await getOwnedCollectionBySlug(user.id, slug);
  if (!collection) {
    return NextResponse.json({ error: "Collection not found." }, { status: 404 });
  }

  if (placeId) {
    const { error } = await supabase
      .from("collection_places")
      .delete()
      .eq("collection_id", collection.id)
      .eq("place_id", placeId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: "Place removed from collection." });
  }

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collection.id)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Collection deleted." });
}
