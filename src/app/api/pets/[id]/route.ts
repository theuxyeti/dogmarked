import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";
import {
  mapDogProfileRow,
  petToDbUpdate,
  type DogProfileRow,
} from "@/lib/pets";
import { isSupabaseConfigured } from "@/lib/utils";

const sizeEnum = z.enum(["toy", "small", "medium", "large", "giant", "unknown"]);

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  weightKg: z.number().positive().max(200).optional().nullable(),
  weightLb: z.number().positive().max(440).optional().nullable(),
  sizeClass: sizeEnum.optional().nullable(),
  size: sizeEnum.optional().nullable(),
  breed: z.string().trim().max(120).optional().nullable(),
  travelsInCarrier: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  photoPath: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  publicDisplayEnabled: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Could not update pets right now." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!id || id.startsWith("local-")) {
    return NextResponse.json({ error: "Invalid pet id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the pet details and try again." }, { status: 400 });
  }

  const updates = petToDbUpdate(parsed.data);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
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
    .from("dog_profiles")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    logServerError("pets.PATCH", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not update that pet.") },
      { status: 400 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Pet not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    pet: mapDogProfileRow(data as DogProfileRow),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Could not update pets right now." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!id || id.startsWith("local-")) {
    return NextResponse.json({ error: "Invalid pet id." }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("dog_profiles")
    .select("id, photo_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Pet not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("dog_profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    logServerError("pets.DELETE", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not remove that pet.") },
      { status: 400 },
    );
  }

  if (existing.photo_path) {
    const { PET_PHOTOS_BUCKET } = await import("@/lib/storage/pet-photos");
    await supabase.storage.from(PET_PHOTOS_BUCKET).remove([String(existing.photo_path)]);
  }

  return NextResponse.json({ ok: true });
}
