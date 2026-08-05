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
