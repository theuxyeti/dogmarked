import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";
import {
  mapDogProfileRow,
  type DogProfileRow,
} from "@/lib/pets";
import { signPetPhotoUrl } from "@/lib/storage/pet-photos";
import { isSupabaseConfigured } from "@/lib/utils";

async function mapPetsWithPhotos(
  supabase: Parameters<typeof signPetPhotoUrl>[0],
  rows: DogProfileRow[],
) {
  return Promise.all(
    rows.map(async (row) => {
      const signed = await signPetPhotoUrl(supabase, row.photo_path);
      return mapDogProfileRow(row, { photoUrl: signed });
    }),
  );
}

const bodySchema = z.object({
  petIds: z.array(z.string().uuid()).max(20),
});

/**
 * Replace the caller's active pack (multi-pet).
 * Body: { petIds: string[] } — empty array clears the pack.
 */
export async function PUT(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Could not update your pack right now." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "petIds must be an array of pet ids." }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("set_active_pack", {
    pet_ids: parsed.data.petIds,
  });

  if (error) {
    // Fallback when migration 016 is not applied yet: update is_active column-wise.
    if (
      error.message?.includes("set_active_pack") ||
      error.code === "PGRST202" ||
      error.code === "42883"
    ) {
      const { error: clearError } = await supabase
        .from("dog_profiles")
        .update({ is_active: false })
        .eq("user_id", user.id);

      if (clearError) {
        logServerError("pets.active-pack.clear", clearError);
        return NextResponse.json(
          {
            error: publicApiError(
              clearError,
              "Could not update active pack. Apply migration 016.",
            ),
          },
          { status: 400 },
        );
      }

      if (parsed.data.petIds.length > 0) {
        const { error: setError } = await supabase
          .from("dog_profiles")
          .update({ is_active: true })
          .eq("user_id", user.id)
          .in("id", parsed.data.petIds);

        if (setError) {
          logServerError("pets.active-pack.set", setError);
          return NextResponse.json(
            { error: publicApiError(setError, "Could not update active pack.") },
            { status: 400 },
          );
        }
      }

      const { data: rows, error: listError } = await supabase
        .from("dog_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (listError) {
        logServerError("pets.active-pack.list", listError);
        return NextResponse.json(
          { error: publicApiError(listError, "Could not load pets.") },
          { status: 400 },
        );
      }

      const pets = await mapPetsWithPhotos(
        supabase,
        (rows ?? []) as DogProfileRow[],
      );
      return NextResponse.json({
        ok: true,
        pets,
        activePack: pets.filter((p) => p.isActive),
      });
    }

    logServerError("pets.active-pack", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not update active pack.") },
      { status: 400 },
    );
  }

  const pets = await mapPetsWithPhotos(
    supabase,
    (Array.isArray(data) ? data : []) as DogProfileRow[],
  );

  return NextResponse.json({
    ok: true,
    pets,
    activePack: pets.filter((p) => p.isActive),
  });
}

export const PATCH = PUT;
