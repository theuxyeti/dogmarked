/** Supabase Storage bucket for permanently licensed user evidence photos. */
export const PLACE_PHOTOS_BUCKET = "place-photos";

export const PLACE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const PLACE_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PlacePhotoMime = (typeof PLACE_PHOTO_MIME_TYPES)[number];

/** Path convention: {userId}/{placeId}/{objectId}.{ext} */
export function buildPlacePhotoStoragePath(args: {
  userId: string;
  placeId: string;
  objectId: string;
  ext: "jpg" | "png" | "webp";
}): string {
  return `${args.userId}/${args.placeId}/${args.objectId}.${args.ext}`;
}

export function extForMime(mime: string): "jpg" | "png" | "webp" | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}
