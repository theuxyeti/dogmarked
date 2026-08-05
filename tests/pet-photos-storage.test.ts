import { describe, expect, it, vi } from "vitest";
import {
  PET_PHOTOS_BUCKET,
  buildPetPhotoStoragePath,
  extForMime,
  signPetPhotoUrl,
} from "@/lib/storage/pet-photos";

describe("pet-photos storage helpers", () => {
  it("uses a stable bucket name", () => {
    expect(PET_PHOTOS_BUCKET).toBe("pet-photos");
  });

  it("builds user/pet scoped object paths", () => {
    expect(
      buildPetPhotoStoragePath({
        userId: "user-1",
        petId: "pet-1",
        objectId: "obj-1",
        ext: "jpg",
      }),
    ).toBe("user-1/pet-1/obj-1.jpg");
  });

  it("maps mime types to extensions", () => {
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("image/gif")).toBeNull();
  });

  it("passes through existing http URLs", async () => {
    const url = "https://example.com/photo.jpg";
    expect(await signPetPhotoUrl({} as never, url)).toBe(url);
  });

  it("returns null for empty paths", async () => {
    expect(await signPetPhotoUrl({} as never, null)).toBeNull();
    expect(await signPetPhotoUrl({} as never, "")).toBeNull();
  });

  it("creates a signed URL for storage paths", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example/pet.jpg" },
      error: null,
    });
    const supabase = {
      storage: {
        from: vi.fn().mockReturnValue({ createSignedUrl }),
      },
    };

    const signed = await signPetPhotoUrl(supabase, "user-1/pet-1/obj.jpg");
    expect(supabase.storage.from).toHaveBeenCalledWith(PET_PHOTOS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/pet-1/obj.jpg", 60 * 60 * 24);
    expect(signed).toBe("https://signed.example/pet.jpg");
  });
});
