"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PlaceWithPolicy } from "@/lib/types";

export interface MapViewProps {
  places: PlaceWithPolicy[];
  selectedSlug?: string | null;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onSelect?: (place: PlaceWithPolicy) => void;
  onBoundsChange?: (bbox: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }) => void;
  onViewportChange?: (viewport: { lat: number; lng: number; zoom: number }) => void;
  className?: string;
}

function styleUrl() {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
  }
  return "https://demotiles.maplibre.org/style.json";
}

export function MapView({
  places,
  selectedSlug,
  initialCenter,
  initialZoom,
  onSelect,
  onBoundsChange,
  onViewportChange,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const onBoundsRef = useRef(onBoundsChange);
  const onViewportRef = useRef(onViewportChange);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onBoundsRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    onViewportRef.current = onViewportChange;
  }, [onViewportChange]);

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

    map.on("load", emitBounds);
    map.on("moveend", emitBounds);

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // initial center/zoom only for first mount
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
      el.className =
        place.slug === selectedSlug
          ? "h-4 w-4 rounded-full border-2 border-white bg-teal-deep shadow-md"
          : "h-3.5 w-3.5 rounded-full border-2 border-white bg-teal shadow";
      el.style.cursor = "pointer";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current?.(place);
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

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
