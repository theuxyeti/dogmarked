/**
 * Explore URL state: parse/serialize map position, filters, and selection.
 * Designed for Next.js App Router searchParams (string | string[] | undefined).
 */

import type { PlaceCategory } from "@/lib/types";

export type { PlaceCategory };

export type DogStatusFilter =
  | "dogs_welcome"
  | "dogs_ok_outdoors"
  | "dogs_ok_with_restrictions"
  | "ask_first"
  | "service_animals_only"
  | "no_dogs";

export type ExploreLayer = "all" | "saved" | "verified" | "needs_verification";

export interface ExploreFilters {
  categories: PlaceCategory[];
  dogStatuses: DogStatusFilter[];
  layer: ExploreLayer;
  query: string;
}

export interface ExploreUrlState {
  lat: number;
  lng: number;
  zoom: number;
  filters: ExploreFilters;
  selectedSlug: string | null;
}

/** South Florida default viewport (Boca–Fort Lauderdale corridor). */
export const DEFAULT_EXPLORE_STATE: ExploreUrlState = {
  lat: 26.05,
  lng: -80.14,
  zoom: 9.2,
  filters: {
    categories: [],
    dogStatuses: [],
    layer: "all",
    query: "",
  },
  selectedSlug: null,
};

const CATEGORIES = new Set<PlaceCategory>([
  "park",
  "restaurant",
  "beach",
  "hotel",
  "cafe",
  "other",
  "attraction",
  "landmark",
  "shopping",
  "transport",
  "pet_service",
]);

const DOG_STATUSES = new Set<DogStatusFilter>([
  "dogs_welcome",
  "dogs_ok_outdoors",
  "dogs_ok_with_restrictions",
  "ask_first",
  "service_animals_only",
  "no_dogs",
]);

const LAYERS = new Set<ExploreLayer>([
  "all",
  "saved",
  "verified",
  "needs_verification",
]);

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getParam(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) {
    return params.get(key) ?? undefined;
  }
  return first(params[key]);
}

function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseList<T extends string>(
  raw: string | undefined,
  allowed: Set<T>,
): T[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is T => allowed.has(s as T));
}

export function parseExploreUrlState(params: RawParams): ExploreUrlState {
  const layerRaw = getParam(params, "layer");
  const layer =
    layerRaw && LAYERS.has(layerRaw as ExploreLayer)
      ? (layerRaw as ExploreLayer)
      : DEFAULT_EXPLORE_STATE.filters.layer;

  const selected = getParam(params, "place") ?? getParam(params, "selected");

  return {
    lat: parseNumber(getParam(params, "lat"), DEFAULT_EXPLORE_STATE.lat),
    lng: parseNumber(getParam(params, "lng"), DEFAULT_EXPLORE_STATE.lng),
    zoom: parseNumber(getParam(params, "z") ?? getParam(params, "zoom"), DEFAULT_EXPLORE_STATE.zoom),
    filters: {
      categories: parseList(getParam(params, "cat"), CATEGORIES),
      dogStatuses: parseList(getParam(params, "status"), DOG_STATUSES),
      layer,
      query: (getParam(params, "q") ?? "").trim(),
    },
    selectedSlug: selected?.trim() || null,
  };
}

export function serializeExploreUrlState(
  state: ExploreUrlState,
  options?: { omitDefaults?: boolean },
): URLSearchParams {
  const omit = options?.omitDefaults ?? true;
  const params = new URLSearchParams();
  const d = DEFAULT_EXPLORE_STATE;

  if (!omit || state.lat !== d.lat) params.set("lat", String(roundCoord(state.lat)));
  if (!omit || state.lng !== d.lng) params.set("lng", String(roundCoord(state.lng)));
  if (!omit || state.zoom !== d.zoom) params.set("z", String(roundZoom(state.zoom)));

  if (state.filters.categories.length) {
    params.set("cat", state.filters.categories.join(","));
  }
  if (state.filters.dogStatuses.length) {
    params.set("status", state.filters.dogStatuses.join(","));
  }
  if (!omit || state.filters.layer !== d.filters.layer) {
    params.set("layer", state.filters.layer);
  }
  if (state.filters.query) {
    params.set("q", state.filters.query);
  }
  if (state.selectedSlug) {
    params.set("place", state.selectedSlug);
  }

  return params;
}

export function exploreStateToSearchString(
  state: ExploreUrlState,
  options?: { omitDefaults?: boolean },
): string {
  const params = serializeExploreUrlState(state, options);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function mergeExploreUrlState(
  current: ExploreUrlState,
  patch: Partial<ExploreUrlState> & {
    filters?: Partial<ExploreFilters>;
  },
): ExploreUrlState {
  return {
    ...current,
    ...patch,
    filters: {
      ...current.filters,
      ...(patch.filters ?? {}),
    },
  };
}

function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

function roundZoom(n: number): number {
  return Math.round(n * 100) / 100;
}
