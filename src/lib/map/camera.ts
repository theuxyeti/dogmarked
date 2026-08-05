/** Single place for Explore camera heuristics — avoids competing flyTo/easeTo callers. */

export type CameraMode =
  | "idle"
  | "locality-focus"
  | "nearby-fit"
  | "place-focus"
  | "user-controlled";

export type CameraPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function exploreMapPadding(args: {
  drawerOpen: boolean;
  drawerWidth?: number;
  headerHeight?: number;
  isDesktop: boolean;
}): CameraPadding {
  const header = args.headerHeight ?? 64;
  const drawer = args.drawerWidth ?? 460;
  return {
    top: header + 24,
    right: args.isDesktop && args.drawerOpen ? drawer + 32 : 32,
    bottom: 48,
    left: 32,
  };
}

/** Locality / city zoom when no bbox is available. */
export function localityZoom(kind?: string | null): number {
  const k = (kind ?? "").toLowerCase();
  if (k.includes("country") || k.includes("region") || k.includes("state")) return 8;
  if (k.includes("city") || k.includes("municipality") || k === "locality") return 12.5;
  if (k.includes("town") || k.includes("village") || k.includes("hamlet")) return 14.2;
  if (k.includes("neighbourhood") || k.includes("neighborhood") || k.includes("suburb")) {
    return 14.5;
  }
  if (k.includes("address") || k.includes("street")) return 16;
  if (k.includes("poi") || k.includes("place")) return 16;
  // Default: destination / unnamed locality search
  return 13.5;
}

/** Street-level focus for a selected place — never county-wide. */
export function placeFocusZoom(currentZoom?: number): number {
  const z = currentZoom ?? 14;
  return Math.min(17, Math.max(15.5, z));
}

/** Cap fitBounds zoom so a tight cluster of hotels does not over-zoom. */
export const NEARBY_FIT_MAX_ZOOM = 15.5;
export const NEARBY_FIT_MIN_ZOOM = 11;
