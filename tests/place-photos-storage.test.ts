import { describe, expect, it } from "vitest";
import {
  PLACE_PHOTOS_BUCKET,
  buildPlacePhotoStoragePath,
  extForMime,
} from "@/lib/storage/place-photos";

describe("place-photos storage helpers", () => {
  it("uses a stable bucket name", () => {
    expect(PLACE_PHOTOS_BUCKET).toBe("place-photos");
  });

  it("builds user/place scoped object paths", () => {
    expect(
      buildPlacePhotoStoragePath({
        userId: "user-1",
        placeId: "place-1",
        objectId: "obj-1",
        ext: "jpg",
      }),
    ).toBe("user-1/place-1/obj-1.jpg");
  });

  it("maps mime types to extensions", () => {
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("image/gif")).toBeNull();
  });
});
