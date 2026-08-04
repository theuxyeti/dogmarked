"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { ExploreFiltersPanel } from "@/components/explore/explore-filters";
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
import { filterPlaces } from "@/lib/places/filter";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { PlaceWithPolicy } from "@/lib/types";
import {
  exploreStateToSearchString,
  mergeExploreUrlState,
  type ExploreUrlState,
} from "@/lib/url-state";
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

export function ExploreClient({
  initialPlaces,
  initialState,
}: {
  initialPlaces: PlaceWithPolicy[];
  initialState: ExploreUrlState;
}) {
  const router = useRouter();
  const [places, setPlaces] = useState(initialPlaces);
  const [state, setState] = useState(initialState);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialState.selectedSlug));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bbox, setBbox] = useState<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());
  const skipUrlWrite = useRef(true);
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedSlug = state.selectedSlug;

  const visiblePlaces = useMemo(
    () => filterPlaces(places, state.filters, { savedPlaceIds }),
    [places, state.filters, savedPlaceIds],
  );

  const selected = useMemo(
    () => visiblePlaces.find((p) => p.slug === selectedSlug) ?? places.find((p) => p.slug === selectedSlug) ?? null,
    [visiblePlaces, places, selectedSlug],
  );

  useEffect(() => {
    void fetch("/api/saves")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { saves?: Array<{ placeId: string }> };
        setSavedPlaceIds(new Set((data.saves ?? []).map((s) => s.placeId)));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (skipUrlWrite.current) {
      skipUrlWrite.current = false;
      return;
    }
    const qs = exploreStateToSearchString(state);
    router.replace(`/explore${qs}`, { scroll: false });
  }, [state, router]);

  useEffect(() => {
    return () => {
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
    };
  }, []);

  const patchState = useCallback((patch: Parameters<typeof mergeExploreUrlState>[1]) => {
    setState((prev) => mergeExploreUrlState(prev, patch));
  }, []);

  const onViewportChange = useCallback(
    (viewport: { lat: number; lng: number; zoom: number }) => {
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
      viewportTimer.current = setTimeout(() => {
        setState((prev) => {
          const same =
            Math.abs(prev.lat - viewport.lat) < 0.00005 &&
            Math.abs(prev.lng - viewport.lng) < 0.00005 &&
            Math.abs(prev.zoom - viewport.zoom) < 0.05;
          if (same) return prev;
          return mergeExploreUrlState(prev, viewport);
        });
      }, 350);
    },
    [],
  );

  const selectPlace = useCallback(
    (place: PlaceWithPolicy) => {
      patchState({ selectedSlug: place.slug });
      setSheetOpen(true);
    },
    [patchState],
  );

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

  const activeFilterCount =
    state.filters.categories.length +
    state.filters.dogStatuses.length +
    (state.filters.query ? 1 : 0) +
    (state.filters.layer !== "all" ? 1 : 0);

  return (
    <div className="relative flex h-[calc(100dvh-0px)] flex-col md:h-[calc(100dvh-57px)]">
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
            <Button
              size="sm"
              variant="outline"
              className="shadow-sm md:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
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
        <aside className="hidden w-[360px] shrink-0 flex-col border-r border-border bg-card/90 md:flex">
          <div className="border-b border-border px-4 py-4">
            <h1 className="font-display text-3xl text-teal-deep">Dogmarked</h1>
            <p className="mt-1 text-sm text-muted">
              Build your map of dog-friendly places and read the rules before you arrive.
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">
              {visiblePlaces.length} places in view
            </p>
          </div>
          <div className="border-b border-border px-4 py-3">
            <ExploreFiltersPanel
              filters={state.filters}
              onChange={(filters) => patchState({ filters })}
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
            {visiblePlaces.map((place) => {
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
            {visiblePlaces.length === 0 ? (
              <li className="px-4 py-8 text-sm text-muted">
                No places match these filters. Clear filters or search this area.
              </li>
            ) : null}
          </ul>
        </aside>

        <div
          className={cn(
            "relative min-h-0 min-w-0 flex-1",
            mobileView === "list" && "hidden md:block",
          )}
        >
          <MapView
            places={visiblePlaces}
            selectedSlug={selectedSlug}
            initialCenter={{ lat: initialState.lat, lng: initialState.lng }}
            initialZoom={initialState.zoom}
            onSelect={selectPlace}
            onBoundsChange={setBbox}
            onViewportChange={onViewportChange}
            className="absolute inset-0 h-full w-full"
          />
        </div>

        <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-border bg-card/95 p-4 lg:block">
          {selected ? (
            <PlaceDetail
              place={selected}
              dogs={DEFAULT_DOG_PROFILES}
              onClose={() => patchState({ selectedSlug: null })}
            />
          ) : (
            <div className="flex h-full flex-col justify-center gap-2 text-sm text-muted">
              <p className="font-display text-2xl text-ink">Select a place</p>
              <p>Pins and list share the same filtered results. Compatibility uses Sugar & Munch.</p>
            </div>
          )}
        </aside>
      </div>

      {mobileView === "list" ? (
        <div className="min-h-0 flex-1 overflow-y-auto bg-card pb-24 md:hidden">
          <div className="safe-px border-b border-border py-4">
            <h1 className="font-display text-3xl text-teal-deep">Dogmarked</h1>
            <p className="text-sm text-muted">{visiblePlaces.length} places</p>
          </div>
          <ul>
            {visiblePlaces.map((place) => {
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

      <div className="lg:hidden">
        <Sheet
          open={sheetOpen && Boolean(selected)}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) patchState({ selectedSlug: null });
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

      <div className="md:hidden">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <ExploreFiltersPanel
                filters={state.filters}
                onChange={(filters) => patchState({ filters })}
              />
            </div>
            <Button className="mt-6 w-full" onClick={() => setFiltersOpen(false)}>
              Show {visiblePlaces.length} places
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
