import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";
import {
  mapDogProfileRow,
  type DogProfileRow,
} from "@/lib/pets";
import {
  PET_PHOTOS_BUCKET,
  PET_PHOTO_MAX_BYTES,
  PET_PHOTO_MIME_TYPES,
  buildPetPhotoStoragePath,
  extForMime,
} from "@/lib/storage/pet-photos";
import { isSupabaseConfigured } from "@/lib/utils";

const ALLOWED_TYPES = new Set<string>(PET_PHOTO_MIME_TYPES);

const fieldsSchema = z.object({
  petId: z.string().uuid(),
});

/**
 * Upload a pet profile photo into the pet-photos bucket.
 * Path: {userId}/{petId}/{uuid}.{ext}
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
    petId: form.get("petId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "petId is required." }, { status: 400 });
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
  if (file.size <= 0 || file.size > PET_PHOTO_MAX_BYTES) {
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

  const { data: pet, error: petError } = await supabase
    .from("dog_profiles")
    .select("id, photo_path")
    .eq("id", parsed.data.petId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (petError || !pet) {
    return NextResponse.json({ error: "Pet not found." }, { status: 404 });
  }

  const ext = extForMime(file.type);
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }

  const objectId = crypto.randomUUID();
  const storagePath = buildPetPhotoStoragePath({
    userId: user.id,
    petId: parsed.data.petId,
    objectId,
    ext,
  });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(PET_PHOTOS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    logServerError("pets.photo.upload", uploadError);
    return NextResponse.json(
      {
        error:
          uploadError.message ??
          "Upload failed. Apply migration 016 (pet-photos bucket) if missing.",
      },
      { status: 400 },
    );
  }

  const previousPath =
    typeof pet.photo_path === "string" && pet.photo_path.length > 0
      ? pet.photo_path
      : null;

  const { data: updated, error: updateError } = await supabase
    .from("dog_profiles")
    .update({ photo_path: storagePath })
    .eq("id", parsed.data.petId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    await supabase.storage.from(PET_PHOTOS_BUCKET).remove([storagePath]);
    logServerError("pets.photo.update", updateError);
    return NextResponse.json(
      { error: publicApiError(updateError, "Could not save photo path.") },
      { status: 400 },
    );
  }

  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(PET_PHOTOS_BUCKET).remove([previousPath]);
  }

  return NextResponse.json({
    ok: true,
    storagePath,
    pet: mapDogProfileRow(updated as DogProfileRow),
  });
}
