"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, {
  type LngLatBoundsLike,
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
  type Marker,
  type PaddingOptions,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  NEARBY_FIT_MAX_ZOOM,
  NEARBY_FIT_MIN_ZOOM,
  type CameraMode,
} from "@/lib/map/camera";
import {
  createClusterMarkerElement,
  createPolicyMarkerElement,
} from "@/lib/map/create-marker-element";
import type { MarkerShellStatus } from "@/lib/map/marker-policy";
import type { PlaceWithPolicy } from "@/lib/types";

const DEBUG_MAP =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEBUG_MAP === "1";

export type MapPlace = PlaceWithPolicy & {
  saveLayer?: "mine" | "others" | "candidate" | "shared";
  saveStatus?: "want_to_go" | "been_there" | "visited";
  emoji?: string;
  contributorCount?: number;
  /** Dogmarked policy shell status (never inferred from Foursquare). */
  policyStatus?: MarkerShellStatus;
};

export type MapClickTarget =
  | { type: "dogmarked"; place: PlaceWithPolicy }
  | {
      type: "contextual_poi";
      name: string;
      lat: number;
      lng: number;
      layerId?: string;
      properties?: Record<string, unknown>;
    }
  | { type: "empty"; lat: number; lng: number };

export type TempPin = {
  lat: number;
  lng: number;
  radiusMeters: number;
};

export type RenderedPoiQuery = {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  layerId?: string;
  className?: string;
  subclass?: string;
};

export type MapViewApi = {
  queryRenderedPoisAround: (
    lat: number,
    lng: number,
    radiusMeters: number,
  ) => RenderedPoiQuery[];
  /** Resolve after the next map idle (or timeout) so POI tiles are queryable. */
  whenIdle: (timeoutMs?: number) => Promise<void>;
  fitNearby: (
    points: Array<{ lat: number; lng: number }>,
    padding?: PaddingOptions,
  ) => void;
  resize: () => void;
  getCameraMode: () => CameraMode;
};

type FeatureHit = ReturnType<MapLibreMap["queryRenderedFeatures"]>;

export interface MapViewProps {
  places: MapPlace[];
  selectedSlug?: string | null;
  selectedCandidateId?: string | null;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  /** When true, skip automatic selectedSlug camera moves (locality/nearby owns camera). */
  suppressAutoFocus?: boolean;
  tempPin?: TempPin | null;
  chooseLocationMode?: boolean;
  paddingRight?: number;
  mapPadding?: PaddingOptions;
  onSelect?: (place: PlaceWithPolicy) => void;
  onMapClick?: (target: MapClickTarget) => void;
  onTempPinChange?: (pin: { lat: number; lng: number }) => void;
  onTempPinDragEnd?: (pin: { lat: number; lng: number }) => void;
  onBoundsChange?: (bbox: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }) => void;
  onViewportChange?: (viewport: { lat: number; lng: number; zoom: number }) => void;
  onMapApi?: (api: MapViewApi | null) => void;
  className?: string;
}

const POI_LAYER_HINTS = [
  "poi",
  "place_label",
  "airport_label",
  "transit",
  "label",
];

const RADIUS_SOURCE = "dm-search-radius";
const RADIUS_FILL = "dm-search-radius-fill";
const RADIUS_LINE = "dm-search-radius-line";
const CLUSTER_MAX_ZOOM = 12;
const CLUSTER_CELL_PX = 56;

function styleUrl() {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
  }
  return "https://demotiles.maplibre.org/style.json";
}

function placePolicyStatus(place: MapPlace): MarkerShellStatus {
  if (place.policyStatus) return place.policyStatus;
  return "unknown";
}

function isSelectedPlace(
  place: MapPlace,
  selectedSlug?: string | null,
  selectedCandidateId?: string | null,
) {
  return (
    place.slug === selectedSlug ||
    place.id === selectedCandidateId ||
    place.slug === selectedCandidateId
  );
}

type ClusterBucket = {
  places: MapPlace[];
  lat: number;
  lng: number;
};

/** Simple screen-space clustering for HTML markers at low zoom. */
function clusterPlaces(
  map: MapLibreMap,
  places: MapPlace[],
): Array<{ kind: "place"; place: MapPlace } | { kind: "cluster"; bucket: ClusterBucket }> {
  const zoom = map.getZoom();
  if (zoom >= CLUSTER_MAX_ZOOM || places.length <= 1) {
    return places.map((place) => ({ kind: "place" as const, place }));
  }

  const cells = new Map<string, ClusterBucket>();
  for (const place of places) {
    const pt = map.project([place.lng, place.lat]);
    const key = `${Math.floor(pt.x / CLUSTER_CELL_PX)}:${Math.floor(pt.y / CLUSTER_CELL_PX)}`;
    const existing = cells.get(key);
    if (existing) {
      existing.places.push(place);
      const n = existing.places.length;
      existing.lat = (existing.lat * (n - 1) + place.lat) / n;
      existing.lng = (existing.lng * (n - 1) + place.lng) / n;
    } else {
      cells.set(key, { places: [place], lat: place.lat, lng: place.lng });
    }
  }

  const out: Array<
    { kind: "place"; place: MapPlace } | { kind: "cluster"; bucket: ClusterBucket }
  > = [];
  for (const bucket of cells.values()) {
    if (bucket.places.length === 1) {
      out.push({ kind: "place", place: bucket.places[0]! });
    } else {
      out.push({ kind: "cluster", bucket });
    }
  }
  return out;
}

/** Approximate circle polygon in lon/lat for the search radius. */
function circlePolygon(lat: number, lng: number, radiusMeters: number, steps = 64) {
  const coords: [number, number][] = [];
  const earth = 6371000;
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat1 = (lat * Math.PI) / 180;
    const lng1 = (lng * Math.PI) / 180;
    const ang = radiusMeters / earth;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(ang) +
        Math.cos(lat1) * Math.sin(ang) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(ang) * Math.cos(lat1),
        Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
      );
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}

export function MapView({
  places,
  selectedSlug,
  selectedCandidateId,
  initialCenter,
  initialZoom,
  flyTo,
  suppressAutoFocus = false,
  tempPin,
  chooseLocationMode,
  paddingRight = 0,
  mapPadding,
  onSelect,
  onMapClick,
  onTempPinChange,
  onTempPinDragEnd,
  onBoundsChange,
  onViewportChange,
  onMapApi,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const tempMarkerRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  const onBoundsRef = useRef(onBoundsChange);
  const onViewportRef = useRef(onViewportChange);
  const onTempPinChangeRef = useRef(onTempPinChange);
  const onTempPinDragEndRef = useRef(onTempPinDragEnd);
  const onMapApiRef = useRef(onMapApi);
  const chooseModeRef = useRef(chooseLocationMode);
  const placesRef = useRef(places);
  const selectedSlugRef = useRef(selectedSlug);
  const selectedCandidateIdRef = useRef(selectedCandidateId);
  const zoomRafRef = useRef<number | null>(null);
  const cameraModeRef = useRef<CameraMode>("idle");
  const constructCountRef = useRef(0);
  const suppressAutoFocusRef = useRef(suppressAutoFocus);
  const lastFlyToKeyRef = useRef<string | null>(null);
  const lastPaddingKeyRef = useRef<string | null>(null);
  const lastContainerSizeRef = useRef<{ w: number; h: number } | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressBoundsEmitRef = useRef(false);

  const placesSignature = useMemo(
    () =>
      places
        .map(
          (p) =>
            `${p.id}|${p.lat.toFixed(5)}|${p.lng.toFixed(5)}|${p.category}|${p.policyStatus ?? ""}|${p.saveLayer ?? ""}|${p.emoji ?? ""}|${p.contributorCount ?? 0}`,
        )
        .join(";"),
    [places],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);
  useEffect(() => {
    onBoundsRef.current = onBoundsChange;
  }, [onBoundsChange]);
  useEffect(() => {
    onViewportRef.current = onViewportChange;
  }, [onViewportChange]);
  useEffect(() => {
    onTempPinChangeRef.current = onTempPinChange;
  }, [onTempPinChange]);
  useEffect(() => {
    onTempPinDragEndRef.current = onTempPinDragEnd;
  }, [onTempPinDragEnd]);
  useEffect(() => {
    onMapApiRef.current = onMapApi;
  }, [onMapApi]);
  useEffect(() => {
    chooseModeRef.current = chooseLocationMode;
  }, [chooseLocationMode]);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);
  useEffect(() => {
    selectedSlugRef.current = selectedSlug;
  }, [selectedSlug]);
  useEffect(() => {
    selectedCandidateIdRef.current = selectedCandidateId;
  }, [selectedCandidateId]);
  useEffect(() => {
    suppressAutoFocusRef.current = suppressAutoFocus;
  }, [suppressAutoFocus]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    constructCountRef.current += 1;
    if (DEBUG_MAP) {
      console.info("[dogmarked/map] construct", constructCountRef.current, {
        w: containerRef.current.clientWidth,
        h: containerRef.current.clientHeight,
      });
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl(),
      center: [initialCenter?.lng ?? -80.14, initialCenter?.lat ?? 26.05],
      zoom: initialZoom ?? 9.2,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "top-right",
    );

    map.on("error", (e) => {
      if (DEBUG_MAP) console.error("[dogmarked/map] error", e?.error ?? e);
    });
    map.on("dragstart", () => {
      cameraModeRef.current = "user-controlled";
    });
    map.on("zoomstart", (e) => {
      // Programmatic zoom sets originalEvent to undefined in MapLibre
      if (e.originalEvent) cameraModeRef.current = "user-controlled";
    });

    const emitBoundsNow = () => {
      if (suppressBoundsEmitRef.current) return;
      const b = map.getBounds();
      const c = map.getCenter();
      onBoundsRef.current?.({
        minLng: b.getWest(),
        minLat: b.getSouth(),
        maxLng: b.getEast(),
        maxLat: b.getNorth(),
      });
      onViewportRef.current?.({
        lat: c.lat,
        lng: c.lng,
        zoom: map.getZoom(),
      });
    };

    /** Debounce so resize/padding easeTo cannot flood parent setState → fetch loops. */
    const emitBounds = () => {
      if (boundsTimerRef.current != null) clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = setTimeout(() => {
        boundsTimerRef.current = null;
        emitBoundsNow();
      }, 350);
    };

    const queryRenderedPoisAround = (
      lat: number,
      lng: number,
      radiusMeters: number,
    ): RenderedPoiQuery[] => {
      const point = map.project([lng, lat]);
      // Approximate meters→pixels at this latitude/zoom
      const metersPerPx =
        (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, map.getZoom());
      const px = Math.max(24, Math.min(220, radiusMeters / Math.max(metersPerPx, 0.1)));
      const bbox: [[number, number], [number, number]] = [
        [point.x - px, point.y - px],
        [point.x + px, point.y + px],
      ];
      let features: FeatureHit = [];
      try {
        const layerIds = (map.getStyle()?.layers ?? [])
          .filter(
            (l) =>
              l.type === "symbol" &&
              POI_LAYER_HINTS.some((h) => l.id.toLowerCase().includes(h)),
          )
          .map((l) => l.id);
        features = layerIds.length
          ? map.queryRenderedFeatures(bbox, { layers: layerIds })
          : map.queryRenderedFeatures(bbox);
      } catch {
        features = map.queryRenderedFeatures(bbox);
      }

      const hits: RenderedPoiQuery[] = [];
      for (const f of features) {
        const layerId = f.layer?.id?.toLowerCase() ?? "";
        if (
          layerId.includes("road") ||
          layerId.includes("street") ||
          layerId.includes("highway") ||
          layerId.includes("boundary") ||
          layerId.includes("water") ||
          layerId.includes("housenumber")
        ) {
          continue;
        }
        if (!POI_LAYER_HINTS.some((h) => layerId.includes(h)) && f.layer?.type !== "symbol") {
          continue;
        }
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const name =
          (props.name as string | undefined) ||
          (props.name_en as string | undefined) ||
          (props["name:en"] as string | undefined);
        if (!name) continue;
        let flat = lat;
        let flng = lng;
        if (f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)) {
          flng = Number(f.geometry.coordinates[0]);
          flat = Number(f.geometry.coordinates[1]);
        }
        if (!Number.isFinite(flat) || !Number.isFinite(flng)) continue;
        hits.push({
          id: f.id != null ? String(f.id) : undefined,
          name,
          lat: flat,
          lng: flng,
          layerId: f.layer?.id,
          className: typeof props.class === "string" ? props.class : undefined,
          subclass: typeof props.subclass === "string" ? props.subclass : undefined,
        });
      }
      return hits;
    };

    const whenIdle = (timeoutMs = 1800) =>
      new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const timer = window.setTimeout(done, timeoutMs);
        map.once("idle", () => {
          window.clearTimeout(timer);
          done();
        });
      });

    const fitNearby = (
      points: Array<{ lat: number; lng: number }>,
      padding?: PaddingOptions,
    ) => {
      if (!points.length) return;
      if (cameraModeRef.current === "user-controlled") return;
      cameraModeRef.current = "nearby-fit";
      if (points.length === 1) {
        map.easeTo({
          center: [points[0].lng, points[0].lat],
          zoom: Math.min(NEARBY_FIT_MAX_ZOOM, Math.max(map.getZoom(), 14)),
          padding: padding ?? { top: 48, right: 48, bottom: 48, left: 48 },
          duration: 600,
          essential: true,
        });
        return;
      }
      const bounds = new maplibregl.LngLatBounds();
      for (const p of points) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds as LngLatBoundsLike, {
        padding: padding ?? { top: 48, right: 48, bottom: 48, left: 48 },
        maxZoom: NEARBY_FIT_MAX_ZOOM,
        minZoom: NEARBY_FIT_MIN_ZOOM,
        duration: 700,
        essential: true,
      });
    };

    map.on("load", () => {
      if (DEBUG_MAP) console.info("[dogmarked/map] load");
      emitBoundsNow();
      if (!map.getSource(RADIUS_SOURCE)) {
        map.addSource(RADIUS_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: RADIUS_FILL,
          type: "fill",
          source: RADIUS_SOURCE,
          paint: { "fill-color": "#EE7D59", "fill-opacity": 0.12 },
        });
        map.addLayer({
          id: RADIUS_LINE,
          type: "line",
          source: RADIUS_SOURCE,
          paint: { "line-color": "#EE7D59", "line-width": 2, "line-opacity": 0.7 },
        });
      }
      onMapApiRef.current?.({
        queryRenderedPoisAround,
        whenIdle,
        fitNearby,
        resize: () => map.resize(),
        getCameraMode: () => cameraModeRef.current,
      });
    });
    map.on("moveend", emitBounds);

    const ro = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const prev = lastContainerSizeRef.current;
      if (prev && prev.w === w && prev.h === h) return;
      lastContainerSizeRef.current = { w, h };
      if (resizeTimerRef.current != null) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        resizeTimerRef.current = null;
        // Padding easeTo already adjusts the camera; avoid resize↔moveend feedback.
        if (suppressBoundsEmitRef.current) {
          map.resize();
          return;
        }
        suppressBoundsEmitRef.current = true;
        map.resize();
        window.setTimeout(() => {
          suppressBoundsEmitRef.current = false;
          emitBoundsNow();
        }, 50);
        if (DEBUG_MAP) {
          console.info("[dogmarked/map] resize", { w, h });
        }
      }, 150);
    });
    ro.observe(containerRef.current);

    map.on("click", (e: MapLayerMouseEvent) => {
      if (chooseModeRef.current) {
        onMapClickRef.current?.({
          type: "empty",
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
        });
        return;
      }

      const features = map.queryRenderedFeatures(e.point);
      const poi = features.find((f) =>
        POI_LAYER_HINTS.some((h) => f.layer.id.toLowerCase().includes(h)),
      );

      if (poi) {
        const name =
          (poi.properties?.name as string | undefined) ||
          (poi.properties?.name_en as string | undefined) ||
          "Place";
        onMapClickRef.current?.({
          type: "contextual_poi",
          name,
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          layerId: poi.layer.id,
          properties: (poi.properties as Record<string, unknown>) ?? {},
        });
        return;
      }

      onMapClickRef.current?.({
        type: "empty",
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      });
    });

    mapRef.current = map;

    return () => {
      ro.disconnect();
      if (resizeTimerRef.current != null) clearTimeout(resizeTimerRef.current);
      if (boundsTimerRef.current != null) clearTimeout(boundsTimerRef.current);
      onMapApiRef.current?.(null);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
      if (zoomRafRef.current != null) {
        cancelAnimationFrame(zoomRafRef.current);
        zoomRafRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const padding =
      mapPadding ??
      ({ top: 0, left: 0, bottom: 0, right: paddingRight } satisfies PaddingOptions);
    const key = `${padding.top ?? 0},${padding.right ?? 0},${padding.bottom ?? 0},${padding.left ?? 0}`;
    if (lastPaddingKeyRef.current === key) return;
    lastPaddingKeyRef.current = key;
    suppressBoundsEmitRef.current = true;
    map.easeTo({ padding, duration: 200 });
    // One resize after drawer layout settles — do not let RO/easeTo re-enter.
    requestAnimationFrame(() => {
      map.resize();
      window.setTimeout(() => {
        suppressBoundsEmitRef.current = false;
      }, 250);
    });
  }, [paddingRight, mapPadding]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderMarkers = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const items = clusterPlaces(map, placesRef.current);
      for (const item of items) {
        if (item.kind === "cluster") {
          const el = createClusterMarkerElement(item.bucket.places.length);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            map.easeTo({
              center: [item.bucket.lng, item.bucket.lat],
              zoom: Math.min(map.getZoom() + 1.5, CLUSTER_MAX_ZOOM + 0.5),
              duration: 400,
            });
          });
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([item.bucket.lng, item.bucket.lat])
            .addTo(map);
          markersRef.current.push(marker);
          continue;
        }

        const place = item.place;
        const status = placePolicyStatus(place);
        const selected = isSelectedPlace(
          place,
          selectedSlugRef.current,
          selectedCandidateIdRef.current,
        );
        const el = createPolicyMarkerElement({
          category: place.category,
          policyStatus: status,
          selected,
          emoji: place.emoji,
          name: place.name,
          contributorCount: place.contributorCount,
          compact: place.saveLayer === "candidate",
        });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current?.(place);
          onMapClickRef.current?.({ type: "dogmarked", place });
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([place.lng, place.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    };

    renderMarkers();

    const onZoom = () => {
      if (zoomRafRef.current != null) cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = requestAnimationFrame(() => {
        zoomRafRef.current = null;
        renderMarkers();
      });
    };
    map.on("zoomend", onZoom);

    return () => {
      map.off("zoomend", onZoom);
      if (zoomRafRef.current != null) {
        cancelAnimationFrame(zoomRafRef.current);
        zoomRafRef.current = null;
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
    // Depend on signature so parent array identity churn does not thrash markers.
  }, [placesSignature, selectedSlug, selectedCandidateId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyRadius = () => {
      const source = map.getSource(RADIUS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      if (!tempPin) {
        source.setData({ type: "FeatureCollection", features: [] });
        return;
      }
      source.setData({
        type: "FeatureCollection",
        features: [circlePolygon(tempPin.lat, tempPin.lng, tempPin.radiusMeters)],
      });
    };

    if (map.isStyleLoaded()) applyRadius();
    else map.once("load", applyRadius);

    if (!tempPin) {
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
      return;
    }

    if (!tempMarkerRef.current) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "dm-marker dm-marker--temp";
      el.setAttribute("aria-label", "Search pin");
      el.textContent = "📍";
      const marker = new maplibregl.Marker({
        element: el,
        draggable: true,
      })
        .setLngLat([tempPin.lng, tempPin.lat])
        .addTo(map);

      marker.on("drag", () => {
        const ll = marker.getLngLat();
        onTempPinChangeRef.current?.({ lat: ll.lat, lng: ll.lng });
        const source = map.getSource(RADIUS_SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData({
            type: "FeatureCollection",
            features: [
              circlePolygon(ll.lat, ll.lng, tempPin.radiusMeters),
            ],
          });
        }
      });
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        onTempPinDragEndRef.current?.({ lat: ll.lat, lng: ll.lng });
      });
      tempMarkerRef.current = marker;
    } else {
      tempMarkerRef.current.setLngLat([tempPin.lng, tempPin.lat]);
    }
  }, [tempPin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedSlug || suppressAutoFocusRef.current) return;
    if (cameraModeRef.current === "user-controlled") return;
    if (
      cameraModeRef.current === "locality-focus" ||
      cameraModeRef.current === "nearby-fit"
    ) {
      return;
    }
    const place = placesRef.current.find((p) => p.slug === selectedSlug);
    if (!place) return;
    cameraModeRef.current = "place-focus";
    map.easeTo({
      center: [place.lng, place.lat],
      zoom: Math.min(17, Math.max(map.getZoom(), 15.5)),
      offset: [0, 40],
      duration: 500,
      essential: true,
    });
  }, [selectedSlug, placesSignature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    const key = `${flyTo.lat.toFixed(5)},${flyTo.lng.toFixed(5)},${flyTo.zoom ?? ""}`;
    if (lastFlyToKeyRef.current === key) return;
    lastFlyToKeyRef.current = key;
    cameraModeRef.current = "locality-focus";
    map.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? Math.max(map.getZoom(), 13.5),
      essential: true,
      duration: 900,
    });
  }, [flyTo]);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-full w-full"}
      data-choose-location={chooseLocationMode ? "true" : "false"}
    />
  );
}
