/** Stable URL slug from a place name (+ optional city). */
export function slugifyPlaceName(name: string, city?: string | null): string {
  const base = [name, city]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return base || "place";
}

/** EWKT for PostGIS geography(Point, 4326) via PostgREST. */
export function pointEwkt(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}
