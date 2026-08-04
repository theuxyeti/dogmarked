"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map, type MapLayerMouseEvent, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PlaceWithPolicy } from "@/lib/types";

export type MapPlace = PlaceWithPolicy & {
  saveLayer?: "mine" | "others" | "candidate";
  saveStatus?: "want_to_go" | "been_there" | "visited";
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

export interface MapViewProps {
  places: MapPlace[];
  selectedSlug?: string | null;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  onSelect?: (place: PlaceWithPolicy) => void;
  onMapClick?: (target: MapClickTarget) => void;
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
  if (place.saveLayer === "mine") {
    const been = place.saveStatus === "been_there" || place.saveStatus === "visited";
    return been ? "dm-marker dm-marker--been" : "dm-marker dm-marker--want";
  }
  // Legacy / unsaved catalog pins
  if (!place.policy) return "dm-marker dm-marker--unverified";
  return "dm-marker dm-marker--been";
}

export function MapView({
  places,
  selectedSlug,
  initialCenter,
  initialZoom,
  flyTo,
  onSelect,
  onMapClick,
  onBoundsChange,
  onViewportChange,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  const onBoundsRef = useRef(onBoundsChange);
  const onViewportRef = useRef(onViewportChange);
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
      // Progressive POI reveal: soften low-zoom POI opacity when layers exist
      try {
        const style = map.getStyle();
        for (const layer of style?.layers ?? []) {
          if (
            layer.type === "symbol" &&
            POI_LAYER_HINTS.some((h) => layer.id.toLowerCase().includes(h))
          ) {
            map.setPaintProperty(layer.id, "text-opacity", [
              "interpolate",
              ["linear"],
              ["zoom"],
              11,
              0,
              13,
              0.55,
              15,
              1,
            ]);
          }
        }
      } catch {
        // style may not expose paint props for all layers
      }
    });
    map.on("moveend", emitBounds);

    map.on("click", (e: MapLayerMouseEvent) => {
      // Dogmarked DOM markers stopPropagation — this handles basemap / empty
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
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    places.forEach((place) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", place.name);
      el.className = statusColorClass(place as MapPlace);
      el.dataset.selected = place.slug === selectedSlug ? "true" : "false";
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
  }, [places, selectedSlug]);

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

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
