import { describe, expect, it } from "vitest";
import {
  activePack,
  applyActivePackIds,
  dogProfileToLocalPet,
  formatActivePackLabel,
  mapDogProfileRow,
  petToDbInsert,
  petToDbUpdate,
  petToDogProfile,
  resolveWeightKg,
  toPublicPetIdentity,
} from "@/lib/pets";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import { buildPetPhotoStoragePath, PET_PHOTOS_BUCKET } from "@/lib/storage/pet-photos";

describe("pets helpers", () => {
  it("preserves Sugar & Munch fixture weights (~2.3 kg / 5 lb)", () => {
    const pets = DEFAULT_DOG_PROFILES.map((d) => dogProfileToLocalPet(d));
    expect(pets).toHaveLength(2);
    expect(pets.map((p) => p.name)).toEqual(["Sugar", "Munch"]);
    for (const pet of pets) {
      expect(pet.weightKg).toBeCloseTo(2.3, 5);
      expect(pet.weightLb).toBeCloseTo(5, 0);
      expect(pet.sizeClass).toBe("small");
      expect(pet.travelsInCarrier).toBe(true);
      expect(pet.isActive).toBe(true);
      expect(pet.publicDisplayEnabled).toBe(false);
    }
  });

  it("maps DB rows and active pack", () => {
    const pet = mapDogProfileRow({
      id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      name: "Sugar",
      weight_kg: 2.3,
      size_class: "small",
      travels_in_carrier: true,
      is_active: true,
      public_display_enabled: false,
      breed: null,
      photo_path: null,
      notes: null,
    });
    expect(petToDogProfile(pet).weightKg).toBe(2.3);
    expect(activePack([pet, { ...pet, id: "x", isActive: false }])).toHaveLength(1);
  });

  it("formats Exploring with labels for multi-pet pack", () => {
    const pets = DEFAULT_DOG_PROFILES.map((d) => dogProfileToLocalPet(d));
    expect(formatActivePackLabel(pets)).toBe("Exploring with Sugar & Munch");
    expect(formatActivePackLabel(applyActivePackIds(pets, [pets[0]!.id]))).toBe(
      "Exploring with Sugar",
    );
    expect(formatActivePackLabel(applyActivePackIds(pets, []))).toBe(
      "Add a pet to explore",
    );
  });

  it("resolves weight from lb when kg omitted", () => {
    expect(resolveWeightKg({ weightLb: 5 })).toBeCloseTo(2.268, 2);
    expect(resolveWeightKg({ weightKg: 2.3, weightLb: 99 })).toBe(2.3);
  });

  it("builds insert/update payloads with private defaults", () => {
    const insert = petToDbInsert("user-1", {
      name: "Sugar",
      weightKg: 2.3,
      sizeClass: "small",
      travelsInCarrier: true,
    });
    expect(insert.public_display_enabled).toBe(false);
    expect(insert.is_active).toBe(true);
    expect(insert.weight_kg).toBe(2.3);

    const update = petToDbUpdate({ isActive: false, publicDisplayEnabled: true });
    expect(update).toEqual({
      is_active: false,
      public_display_enabled: true,
    });
  });

  it("only exposes public identity when opted in", () => {
    const pet = dogProfileToLocalPet(DEFAULT_DOG_PROFILES[0]!);
    expect(toPublicPetIdentity(pet)).toBeNull();
    expect(
      toPublicPetIdentity({ ...pet, publicDisplayEnabled: true }),
    ).toEqual({
      id: pet.id,
      name: "Sugar",
      photoPath: null,
    });
  });
});

describe("pet-photos storage helpers", () => {
  it("uses a stable bucket and path convention", () => {
    expect(PET_PHOTOS_BUCKET).toBe("pet-photos");
    expect(
      buildPetPhotoStoragePath({
        userId: "user-1",
        petId: "pet-1",
        objectId: "obj-1",
        ext: "jpg",
      }),
    ).toBe("user-1/pet-1/obj-1.jpg");
  });
});
