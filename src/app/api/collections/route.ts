import { NextResponse } from "next/server";
import { z } from "zod";
import { slugifyCollectionTitle } from "@/lib/collections";
import { listOwnedCollections } from "@/lib/collections/server";
import { isSupabaseConfigured } from "@/lib/utils";

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  visibility: z.enum(["private", "link", "public"]).default("private"),
});

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const collections = await listOwnedCollections(user.id);
  return NextResponse.json({ ok: true, collections });
}

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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required to create a collection." }, { status: 401 });
  }

  const baseSlug = slugifyCollectionTitle(parsed.data.title);
  let slug = baseSlug;

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 5)}`;
    slug = `${baseSlug}${suffix}`.slice(0, 80);

    const { data, error } = await supabase
      .from("collections")
      .insert({
        owner_id: user.id,
        slug,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        visibility: parsed.data.visibility,
      })
      .select("id, slug, title, description, visibility, owner_id")
      .single();

    if (!error && data) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", user.id)
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        collection: {
          id: data.id,
          slug: data.slug,
          title: data.title,
          description: data.description,
          visibility: data.visibility,
          ownerId: data.owner_id,
          ownerHandle: profile?.handle ?? null,
          placeIds: [],
        },
        message: "Collection created.",
      });
    }

    if (error?.code !== "23505") {
      return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Could not allocate a unique slug." }, { status: 409 });
}
