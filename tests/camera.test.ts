import { describe, expect, it } from "vitest";
import {
  exploreMapPadding,
  localityZoom,
  placeFocusZoom,
} from "@/lib/map/camera";

describe("camera helpers", () => {
  it("uses city/town/street zoom bands", () => {
    expect(localityZoom("locality")).toBeGreaterThanOrEqual(11.5);
    expect(localityZoom("locality")).toBeLessThanOrEqual(13);
    expect(localityZoom("village")).toBeGreaterThanOrEqual(13.5);
    expect(localityZoom("address")).toBeGreaterThanOrEqual(15);
  });

  it("keeps place focus at street scale", () => {
    expect(placeFocusZoom(12)).toBeGreaterThanOrEqual(15.5);
    expect(placeFocusZoom(18)).toBeLessThanOrEqual(17);
  });

  it("pads for open desktop drawer", () => {
    const pad = exploreMapPadding({
      drawerOpen: true,
      isDesktop: true,
      drawerWidth: 460,
    });
    expect(pad.right).toBeGreaterThan(460);
  });
});
