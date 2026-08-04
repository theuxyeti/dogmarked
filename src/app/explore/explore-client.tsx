"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { List, Map as MapIcon } from "lucide-react";
import { PlaceDetail } from "@/components/place/place-detail";
import { CompatibilityBadge } from "@/components/place/compatibility-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { computeCompatibility } from "@/lib/compatibility";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { PlaceWithPolicy } from "@/lib/types";
import { cn } from "@/lib/utils";

const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-foam text-sm text-muted">
        Loading map…
      </div>
    ),
  },
);

export function ExploreClient({ initialPlaces }: { initialPlaces: PlaceWithPolicy[] }) {
  const [places, setPlaces] = useState(initialPlaces);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bbox, setBbox] = useState<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
  const [searching, setSearching] = useState(false);

  const selected = useMemo(
    () => places.find((p) => p.slug === selectedSlug) ?? null,
    [places, selectedSlug],
  );

  const selectPlace = useCallback((place: PlaceWithPolicy) => {
    setSelectedSlug(place.slug);
    setSheetOpen(true);
  }, []);

  const searchThisArea = useCallback(async () => {
    if (!bbox) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        minLng: String(bbox.minLng),
        minLat: String(bbox.minLat),
        maxLng: String(bbox.maxLng),
        maxLat: String(bbox.maxLat),
      });
      const res = await fetch(`/api/places?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { places: PlaceWithPolicy[] };
      setPlaces(data.places ?? []);
    } finally {
      setSearching(false);
    }
  }, [bbox]);

  useEffect(() => {
    if (!selectedSlug) setSheetOpen(false);
  }, [selectedSlug]);

  return (
    <div className="relative flex h-[calc(100dvh-0px)] flex-col md:h-[calc(100dvh-57px)]">
      {/* Brand + chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 safe-pt safe-px md:left-[360px]">
        <div className="pointer-events-auto flex items-start justify-between gap-3 pt-3 md:pr-4">
          <div className="rounded-2xl bg-card/90 px-4 py-3 shadow-sm backdrop-blur md:hidden">
            <p className="font-display text-3xl leading-none text-teal-deep">Dogmarked</p>
            <p className="mt-1 max-w-[16rem] text-xs text-muted">
              Can you bring your dog—and under what conditions?
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="shadow-sm"
              disabled={!bbox || searching}
              onClick={searchThisArea}
            >
              {searching ? "Searching…" : "Search this area"}
            </Button>
            <div className="flex overflow-hidden rounded-lg border border-border bg-card shadow-sm md:hidden">
              <button
                type="button"
                className={cn(
                  "flex min-h-11 min-w-11 items-center justify-center",
                  mobileView === "map" && "bg-teal text-primary-foreground",
                )}
                onClick={() => setMobileView("map")}
                aria-label="Map view"
              >
                <MapIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={cn(
                  "flex min-h-11 min-w-11 items-center justify-center",
                  mobileView === "list" && "bg-teal text-primary-foreground",
                )}
                onClick={() => setMobileView("list")}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Desktop left results */}
        <aside className="hidden w-[360px] shrink-0 flex-col border-r border-border bg-card/90 md:flex">
          <div className="border-b border-border px-4 py-4">
            <h1 className="font-display text-3xl text-teal-deep">Dogmarked</h1>
            <p className="mt-1 text-sm text-muted">
              Build your map of dog-friendly places and read the rules before you arrive.
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">
              {places.length} places in view
            </p>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
            {places.map((place) => {
              const compat = computeCompatibility(DEFAULT_DOG_PROFILES, place.policy);
              const active = place.slug === selectedSlug;
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => selectPlace(place)}
                    className={cn(
                      "w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-foam",
                      active && "bg-foam",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-ink">{place.name}</p>
                        <p className="text-xs text-muted">
                          {place.category}
                          {place.city ? ` · ${place.city}` : ""}
                        </p>
                      </div>
                      <CompatibilityBadge verdict={compat.verdict} />
                    </div>
                  </button>
                </li>
              );
            })}
            {places.length === 0 ? (
              <li className="px-4 py-8 text-sm text-muted">
                No places in this area. Pan the map and search again.
              </li>
            ) : null}
          </ul>
        </aside>

        {/* Map */}
        <div
          className={cn(
            "relative min-h-0 min-w-0 flex-1",
            mobileView === "list" && "hidden md:block",
          )}
        >
          <MapView
            places={places}
            selectedSlug={selectedSlug}
            onSelect={selectPlace}
            onBoundsChange={setBbox}
            className="absolute inset-0 h-full w-full"
          />
        </div>

        {/* Desktop detail */}
        <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-border bg-card/95 p-4 lg:block">
          {selected ? (
            <PlaceDetail
              place={selected}
              dogs={DEFAULT_DOG_PROFILES}
              onClose={() => setSelectedSlug(null)}
            />
          ) : (
            <div className="flex h-full flex-col justify-center gap-2 text-sm text-muted">
              <p className="font-display text-2xl text-ink">Select a place</p>
              <p>Pins and list share the same results. Compatibility uses Sugar & Munch.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile list */}
      {mobileView === "list" ? (
        <div className="min-h-0 flex-1 overflow-y-auto bg-card pb-24 md:hidden">
          <div className="safe-px border-b border-border py-4">
            <h1 className="font-display text-3xl text-teal-deep">Dogmarked</h1>
            <p className="text-sm text-muted">{places.length} places</p>
          </div>
          <ul>
            {places.map((place) => {
              const compat = computeCompatibility(DEFAULT_DOG_PROFILES, place.policy);
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => selectPlace(place)}
                    className="w-full border-b border-border px-4 py-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{place.name}</p>
                        <p className="text-xs text-muted">
                          {place.category}
                          {place.city ? ` · ${place.city}` : ""}
                        </p>
                      </div>
                      <CompatibilityBadge verdict={compat.verdict} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Mobile bottom sheet */}
      <div className="lg:hidden">
        <Sheet
          open={sheetOpen && Boolean(selected)}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) setSelectedSlug(null);
          }}
        >
          <SheetContent>
            {selected ? (
              <>
                <SheetHeader>
                  <SheetTitle className="sr-only">{selected.name}</SheetTitle>
                </SheetHeader>
                <PlaceDetail place={selected} dogs={DEFAULT_DOG_PROFILES} />
              </>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
