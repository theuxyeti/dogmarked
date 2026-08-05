import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";
import {
  mapDogProfileRow,
  petToDbInsert,
  type DogProfileRow,
} from "@/lib/pets";
import { signPetPhotoUrl } from "@/lib/storage/pet-photos";
import { isSupabaseConfigured } from "@/lib/utils";

const sizeEnum = z.enum(["toy", "small", "medium", "large", "giant", "unknown"]);

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  weightKg: z.number().positive().max(200).optional().nullable(),
  weightLb: z.number().positive().max(440).optional().nullable(),
  sizeClass: sizeEnum.optional().nullable(),
  size: sizeEnum.optional().nullable(),
  breed: z.string().trim().max(120).optional().nullable(),
  travelsInCarrier: z.boolean().optional().default(false),
  notes: z.string().trim().max(2000).optional().nullable(),
  photoPath: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  publicDisplayEnabled: z.boolean().optional().default(false),
});

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Pets aren’t available yet. Try again later." },
      { status: 503 },
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to see your pets." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("dog_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    logServerError("pets.GET", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not load your pets.") },
      { status: 400 },
    );
  }

  const pets = await Promise.all(
    (data ?? []).map(async (row) => {
      const raw = row as DogProfileRow;
      const signed = await signPetPhotoUrl(supabase, raw.photo_path);
      return mapDogProfileRow(raw, { photoUrl: signed });
    }),
  );
  return NextResponse.json({
    ok: true,
    pets,
    activePack: pets.filter((p) => p.isActive),
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Saving pets requires a connected project." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the pet details and try again." }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to add a pet." }, { status: 401 });
  }

  try {
    await supabase.rpc("ensure_own_profile");
  } catch {
    // migration 012 may be missing in some envs
  }

  const insert = petToDbInsert(user.id, parsed.data);
  const { data, error } = await supabase
    .from("dog_profiles")
    .insert(insert)
    .select("*")
    .single();

  if (error || !data) {
    logServerError("pets.POST", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not add that pet.") },
      { status: 400 },
    );
  }

  const row = data as DogProfileRow;
  const signed = await signPetPhotoUrl(supabase, row.photo_path);
  return NextResponse.json({
    ok: true,
    pet: mapDogProfileRow(row, { photoUrl: signed }),
  });
}
