import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PLACE_PHOTOS_BUCKET,
  PLACE_PHOTO_MAX_BYTES,
  PLACE_PHOTO_MIME_TYPES,
  buildPlacePhotoStoragePath,
  extForMime,
} from "@/lib/storage/place-photos";
import { isSupabaseConfigured } from "@/lib/utils";

const ALLOWED_TYPES = new Set<string>(PLACE_PHOTO_MIME_TYPES);

const fieldsSchema = z.object({
  placeId: z.string().uuid(),
  contributionId: z.string().uuid().optional().nullable(),
  attributionText: z.string().trim().max(500).optional().nullable(),
  license: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional().nullable(),
  confirmRights: z.enum(["true", "on", "1"]),
});

/**
 * Upload a user-owned evidence photo into the place-photos bucket.
 * Requires explicit rights confirmation + license text.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const parsed = fieldsSchema.safeParse({
    placeId: form.get("placeId"),
    contributionId: form.get("contributionId") || null,
    attributionText: form.get("attributionText") || null,
    license: form.get("license"),
    note: form.get("note") || null,
    confirmRights: String(form.get("confirmRights") ?? ""),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "placeId, license, and confirmRights are required. Only upload photos you own or have rights to store.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, or WebP images are allowed." },
      { status: 400 },
    );
  }
  if (file.size <= 0 || file.size > PLACE_PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const ext = extForMime(file.type);
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }
  const objectId = crypto.randomUUID();
  const storagePath = buildPlacePhotoStoragePath({
    userId: user.id,
    placeId: parsed.data.placeId,
    objectId,
    ext,
  });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(PLACE_PHOTOS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        error:
          uploadError.message ??
          "Upload failed. Apply migration 010 (place-photos bucket) if missing.",
      },
      { status: 400 },
    );
  }

  const { data: photo, error: photoError } = await supabase
    .from("place_photos")
    .insert({
      place_id: parsed.data.placeId,
      uploaded_by: user.id,
      source_type: "user_upload",
      source_url: null,
      attribution_text: parsed.data.attributionText ?? null,
      license: parsed.data.license,
      storage_permission: "allowed_permanent",
      storage_path: storagePath,
      caption: parsed.data.note ?? null,
      is_evidence: true,
    })
    .select("id")
    .single();

  if (photoError || !photo) {
    await supabase.storage.from(PLACE_PHOTOS_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: photoError?.message ?? "Could not save photo metadata." },
      { status: 400 },
    );
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from("policy_evidence")
    .insert({
      place_id: parsed.data.placeId,
      contribution_id: parsed.data.contributionId ?? null,
      photo_id: photo.id,
      kind: "photo",
      url: null,
      note: parsed.data.note ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (evidenceError) {
    return NextResponse.json({ error: evidenceError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    evidenceId: evidence.id,
    photoId: photo.id,
    storagePath,
    message: "Evidence photo stored permanently with licensing metadata.",
  });
}
