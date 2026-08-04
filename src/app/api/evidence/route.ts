import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/utils";

const evidenceSchema = z.object({
  placeId: z.string().uuid(),
  contributionId: z.string().uuid().optional().nullable(),
  kind: z.enum(["photo", "url", "note", "other"]).default("url"),
  url: z.string().url().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  /** Licensing — required when attaching a photo/url we might display */
  sourceType: z
    .enum(["user_upload", "placeholder", "partner", "import", "unknown"])
    .default("unknown"),
  attributionText: z.string().trim().max(500).optional().nullable(),
  license: z.string().trim().max(200).optional().nullable(),
  storagePermission: z
    .enum(["allowed_permanent", "link_only", "unknown"])
    .default("link_only"),
});

/**
 * Attach licensing-aware evidence (link/note metadata).
 * Binary permanent uploads go through POST /api/evidence/upload.
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

  const parsed = evidenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  if (!payload.url && !payload.note) {
    return NextResponse.json({ error: "Provide a URL and/or note." }, { status: 400 });
  }

  if (payload.storagePermission === "allowed_permanent") {
    return NextResponse.json(
      {
        error:
          "Use POST /api/evidence/upload for permanent storage (multipart file + license + rights confirmation).",
      },
      { status: 400 },
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let photoId: string | null = null;

  if (payload.url && (payload.kind === "photo" || payload.kind === "url")) {
    const { data: photo, error: photoError } = await supabase
      .from("place_photos")
      .insert({
        place_id: payload.placeId,
        uploaded_by: user.id,
        source_type: payload.sourceType,
        source_url: payload.url,
        attribution_text: payload.attributionText ?? null,
        license: payload.license ?? null,
        storage_permission: payload.storagePermission,
        storage_path: null,
        caption: payload.note ?? null,
        is_evidence: true,
      })
      .select("id")
      .single();

    if (photoError) {
      return NextResponse.json({ error: photoError.message }, { status: 400 });
    }
    photoId = photo.id;
  }

  const { data: evidence, error } = await supabase
    .from("policy_evidence")
    .insert({
      place_id: payload.placeId,
      contribution_id: payload.contributionId ?? null,
      photo_id: photoId,
      kind: payload.kind,
      url: payload.url ?? null,
      note: payload.note ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    evidenceId: evidence.id,
    photoId,
    message:
      payload.storagePermission === "link_only"
        ? "Evidence saved as link-only (not copied into Dogmarked storage)."
        : "Evidence saved.",
  });
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const placeId = new URL(request.url).searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("policy_evidence")
    .select("id, kind, url, note, created_at, place_photos(source_url, attribution_text, license, storage_permission)")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, evidence: data ?? [] });
}
