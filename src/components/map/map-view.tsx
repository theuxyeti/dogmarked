"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map, type MapLayerMouseEvent, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { categoryEmoji } from "@/lib/discovery/category-icons";
import type { PlaceWithPolicy } from "@/lib/types";

export type MapPlace = PlaceWithPolicy & {
  saveLayer?: "mine" | "others" | "candidate" | "shared";
  saveStatus?: "want_to_go" | "been_there" | "visited";
  emoji?: string;
  contributorCount?: number;
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

export interface MapViewProps {
  places: MapPlace[];
  selectedSlug?: string | null;
  selectedCandidateId?: string | null;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  tempPin?: TempPin | null;
  chooseLocationMode?: boolean;
  paddingRight?: number;
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
  className?: string;
}

const POI_LAYER_HINTS = [
  "poi",
  "housenumber",
  "place_label",
  "airport_label",
  "transit",
];

const RADIUS_SOURCE = "dm-search-radius";
const RADIUS_FILL = "dm-search-radius-fill";
const RADIUS_LINE = "dm-search-radius-line";

function styleUrl() {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
  }
  return "https://demotiles.maplibre.org/style.json";
}

function statusColorClass(place: MapPlace): string {
  if (place.saveLayer === "candidate") return "dm-marker dm-marker--candidate";
  if (place.saveLayer === "others") return "dm-marker dm-marker--others";
  if (place.saveLayer === "shared") return "dm-marker dm-marker--been";
  if (place.saveLayer === "mine") {
    const been = place.saveStatus === "been_there" || place.saveStatus === "visited";
    return been ? "dm-marker dm-marker--been" : "dm-marker dm-marker--want";
  }
  if (!place.policy) return "dm-marker dm-marker--unverified";
  return "dm-marker dm-marker--been";
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
  tempPin,
  chooseLocationMode,
  paddingRight = 0,
  onSelect,
  onMapClick,
  onTempPinChange,
  onTempPinDragEnd,
  onBoundsChange,
  onViewportChange,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const tempMarkerRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  const onBoundsRef = useRef(onBoundsChange);
  const onViewportRef = useRef(onViewportChange);
  const onTempPinChangeRef = useRef(onTempPinChange);
  const onTempPinDragEndRef = useRef(onTempPinDragEnd);
  const chooseModeRef = useRef(chooseLocationMode);
  const placesRef = useRef(places);

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
    chooseModeRef.current = chooseLocationMode;
  }, [chooseLocationMode]);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

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

    const emitBounds = () => {
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

    map.on("load", () => {
      emitBounds();
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
    });
    map.on("moveend", emitBounds);

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
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      padding: { top: 0, left: 0, bottom: 0, right: paddingRight },
      duration: 250,
    });
  }, [paddingRight]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    places.forEach((place) => {
      const el = document.createElement("button");
      el.type = "button";
      const emoji =
        place.emoji ?? categoryEmoji(place.category);
      el.setAttribute("aria-label", `${place.name}, ${place.category}`);
      el.className = statusColorClass(place as MapPlace);
      const isSelected =
        place.slug === selectedSlug ||
        place.id === selectedCandidateId ||
        place.slug === selectedCandidateId;
      el.dataset.selected = isSelected ? "true" : "false";
      el.textContent = emoji;
      el.style.fontSize = place.saveLayer === "candidate" ? "14px" : "16px";
      if (place.contributorCount && place.contributorCount > 1) {
        const badge = document.createElement("span");
        badge.className = "dm-marker-count";
        badge.textContent = String(place.contributorCount);
        el.appendChild(badge);
      }
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current?.(place);
        onMapClickRef.current?.({ type: "dogmarked", place });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [places, selectedSlug, selectedCandidateId]);

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
    if (!map || !selectedSlug) return;
    const place = places.find((p) => p.slug === selectedSlug);
    if (!place) return;
    map.easeTo({ center: [place.lng, place.lat], offset: [0, 40], duration: 500 });
  }, [selectedSlug, places]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? Math.max(map.getZoom(), 14),
      essential: true,
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
