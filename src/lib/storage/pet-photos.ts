/** Supabase Storage bucket for user-owned pet profile photos. */
export const PET_PHOTOS_BUCKET = "pet-photos";

export const PET_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const PET_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PetPhotoMime = (typeof PET_PHOTO_MIME_TYPES)[number];

/** Path convention: {userId}/{petId}/{objectId}.{ext} */
export function buildPetPhotoStoragePath(args: {
  userId: string;
  petId: string;
  objectId: string;
  ext: "jpg" | "png" | "webp";
}): string {
  return `${args.userId}/${args.petId}/${args.objectId}.${args.ext}`;
}

export function extForMime(mime: string): "jpg" | "png" | "webp" | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

type StorageSigner = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
};

/** Turn a storage object path into a short-lived signed URL for the client. */
export async function signPetPhotoUrl(
  supabase: StorageSigner,
  photoPath: string | null | undefined,
  expiresInSeconds = 60 * 60 * 24,
): Promise<string | null> {
  if (!photoPath) return null;
  if (/^https?:\/\//i.test(photoPath)) return photoPath;
  const { data, error } = await supabase.storage
    .from(PET_PHOTOS_BUCKET)
    .createSignedUrl(photoPath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
