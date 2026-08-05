/**
 * Pet identity helpers — map dog_profiles ↔ PetProfile / DogProfile.
 * Active pack = pets with isActive === true (multi-pet supported).
 */

import { kgToLb, lbToKg } from "@/lib/units";
import type {
  DogProfile,
  PetProfile,
  PublicPetIdentity,
  SizeClass,
} from "@/lib/types";

export const LOCAL_PETS_STORAGE_KEY = "dogmarked.dog_profiles";

const SIZE_CLASSES = new Set<SizeClass>([
  "toy",
  "small",
  "medium",
  "large",
  "giant",
  "unknown",
]);

/** DB row shape for public.dog_profiles (snake_case). */
export type DogProfileRow = {
  id: string;
  user_id: string;
  name: string;
  weight_kg: number | string | null;
  size_class: string | null;
  travels_in_carrier: boolean | null;
  notes?: string | null;
  photo_path?: string | null;
  breed?: string | null;
  is_active?: boolean | null;
  public_display_enabled?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PetWriteInput = {
  name: string;
  weightKg?: number | null;
  weightLb?: number | null;
  sizeClass?: SizeClass | null;
  size?: SizeClass | null;
  breed?: string | null;
  travelsInCarrier?: boolean;
  notes?: string | null;
  photoPath?: string | null;
  isActive?: boolean;
  publicDisplayEnabled?: boolean;
};

export function parseSizeClass(raw: unknown): SizeClass {
  if (typeof raw === "string" && SIZE_CLASSES.has(raw as SizeClass)) {
    return raw as SizeClass;
  }
  return "unknown";
}

function numOrNull(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Resolve storage kg from kg and/or lb input (kg wins if both set). */
export function resolveWeightKg(input: {
  weightKg?: number | null;
  weightLb?: number | null;
}): number | null {
  const kg = numOrNull(input.weightKg);
  if (kg != null) return kg;
  const lb = numOrNull(input.weightLb);
  if (lb != null) return lbToKg(lb);
  return null;
}

export function mapDogProfileRow(row: DogProfileRow): PetProfile {
  const weightKg = numOrNull(row.weight_kg);
  const sizeClass = parseSizeClass(row.size_class);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    photoPath: row.photo_path ?? null,
    weightKg,
    weightLb: weightKg != null ? Math.round(kgToLb(weightKg) * 10) / 10 : null,
    sizeClass,
    size: sizeClass,
    breed: row.breed ?? null,
    travelsInCarrier: Boolean(row.travels_in_carrier),
    notes: row.notes ?? null,
    isActive: row.is_active !== false,
    publicDisplayEnabled: Boolean(row.public_display_enabled),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function petToDbInsert(
  userId: string,
  input: PetWriteInput,
  id?: string,
): Record<string, unknown> {
  const sizeClass = parseSizeClass(input.sizeClass ?? input.size);
  const row: Record<string, unknown> = {
    user_id: userId,
    name: input.name.trim(),
    weight_kg: resolveWeightKg(input),
    size_class: sizeClass,
    travels_in_carrier: input.travelsInCarrier ?? false,
    notes: input.notes?.trim() || null,
    photo_path: input.photoPath ?? null,
    breed: input.breed?.trim() || null,
    is_active: input.isActive ?? true,
    public_display_enabled: input.publicDisplayEnabled ?? false,
  };
  if (id && !id.startsWith("local-")) {
    row.id = id;
  }
  return row;
}

export function petToDbUpdate(input: Partial<PetWriteInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.name != null) row.name = input.name.trim();
  if (input.weightKg !== undefined || input.weightLb !== undefined) {
    row.weight_kg = resolveWeightKg({
      weightKg: input.weightKg,
      weightLb: input.weightLb,
    });
  }
  if (input.sizeClass != null || input.size != null) {
    row.size_class = parseSizeClass(input.sizeClass ?? input.size);
  }
  if (input.travelsInCarrier != null) {
    row.travels_in_carrier = input.travelsInCarrier;
  }
  if (input.notes !== undefined) row.notes = input.notes?.trim() || null;
  if (input.photoPath !== undefined) row.photo_path = input.photoPath;
  if (input.breed !== undefined) row.breed = input.breed?.trim() || null;
  if (input.isActive != null) row.is_active = input.isActive;
  if (input.publicDisplayEnabled != null) {
    row.public_display_enabled = input.publicDisplayEnabled;
  }
  return row;
}

/** Compatibility / place-detail shape. */
export function petToDogProfile(pet: PetProfile): DogProfile {
  return {
    id: pet.id,
    userId: pet.userId,
    name: pet.name,
    weightKg: pet.weightKg ?? 0,
    sizeClass: pet.sizeClass,
    travelsInCarrier: pet.travelsInCarrier,
  };
}

export function activePack(pets: PetProfile[]): PetProfile[] {
  return pets.filter((p) => p.isActive);
}

export function activePackAsDogs(pets: PetProfile[]): DogProfile[] {
  return activePack(pets).map(petToDogProfile);
}

/** "Exploring with Sugar & Munch" / single / empty. */
export function formatActivePackLabel(pets: PetProfile[]): string {
  const names = activePack(pets).map((p) => p.name.trim()).filter(Boolean);
  if (names.length === 0) return "Add a pet to explore";
  if (names.length === 1) return `Exploring with ${names[0]}`;
  if (names.length === 2) return `Exploring with ${names[0]} & ${names[1]}`;
  const last = names[names.length - 1];
  return `Exploring with ${names.slice(0, -1).join(", ")}, & ${last}`;
}

export function toPublicPetIdentity(pet: PetProfile): PublicPetIdentity | null {
  if (!pet.publicDisplayEnabled) return null;
  return {
    id: pet.id,
    name: pet.name,
    photoPath: pet.photoPath ?? null,
  };
}

export function applyActivePackIds(
  pets: PetProfile[],
  activeIds: string[],
): PetProfile[] {
  const set = new Set(activeIds);
  return pets.map((p) => ({ ...p, isActive: set.has(p.id) }));
}

/** Local guest fixtures → PetProfile (userId empty until signed in). */
export function dogProfileToLocalPet(
  dog: DogProfile,
  extras?: Partial<PetProfile>,
): PetProfile {
  const weightKg =
    typeof dog.weightKg === "number" && Number.isFinite(dog.weightKg)
      ? dog.weightKg
      : null;
  return {
    id: dog.id,
    userId: dog.userId ?? "",
    name: dog.name,
    photoPath: extras?.photoPath ?? null,
    weightKg,
    weightLb: weightKg != null ? Math.round(kgToLb(weightKg) * 10) / 10 : null,
    sizeClass: dog.sizeClass,
    size: dog.sizeClass,
    breed: extras?.breed ?? null,
    travelsInCarrier: dog.travelsInCarrier,
    notes: extras?.notes ?? null,
    isActive: extras?.isActive ?? true,
    publicDisplayEnabled: extras?.publicDisplayEnabled ?? false,
    createdAt: extras?.createdAt,
    updatedAt: extras?.updatedAt,
  };
}
