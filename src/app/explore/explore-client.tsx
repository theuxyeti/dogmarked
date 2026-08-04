"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { ExploreFiltersPanel } from "@/components/explore/explore-filters";
import type { MapClickTarget } from "@/components/map/map-view";
import { PlaceDetail } from "@/components/place/place-detail";
import { CompatibilityBadge } from "@/components/place/compatibility-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { computeCompatibility } from "@/lib/compatibility";
import { filterPlaces } from "@/lib/places/filter";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { ExternalPlace } from "@/lib/places/provider";
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

type WhatsHere = {
  lat: number;
  lng: number;
  label: string;
  source: "contextual_poi" | "empty" | "search";
  reverse: ExternalPlace | null;
  nearby: ExternalPlace[];
};

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
  const [areaMoved, setAreaMoved] = useState(false);
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchKind, setSearchKind] = useState<"all" | "place" | "destination">("all");
  const [searchResults, setSearchResults] = useState<ExternalPlace[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    null,
  );
  const [whatsHere, setWhatsHere] = useState<WhatsHere | null>(null);
  const [isDesktopDetail, setIsDesktopDetail] = useState(false);
  const skipUrlWrite = useRef(true);
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedSlug = state.selectedSlug;

  const visiblePlaces = useMemo(
    () => filterPlaces(places, state.filters, { savedPlaceIds }),
    [places, state.filters, savedPlaceIds],
  );

  const selected = useMemo(
    () =>
      visiblePlaces.find((p) => p.slug === selectedSlug) ??
      places.find((p) => p.slug === selectedSlug) ??
      null,
    [visiblePlaces, places, selectedSlug],
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const sync = () => setIsDesktopDetail(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const patchState = useCallback((patch: Parameters<typeof mergeExploreUrlState>[1]) => {
    setState((prev) => mergeExploreUrlState(prev, patch));
  }, []);

  const onViewportChange = useCallback(
    (viewport: { lat: number; lng: number; zoom: number }) => {
      setAreaMoved(true);
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
      setWhatsHere(null);
      patchState({ selectedSlug: place.slug });
      if (!isDesktopDetail) setSheetOpen(true);
    },
    [patchState, isDesktopDetail],
  );

  const loadWhatsHere = useCallback(
    async (lat: number, lng: number, label: string, source: WhatsHere["source"]) => {
      patchState({ selectedSlug: null });
      setSheetOpen(false);
      setWhatsHere({
        lat,
        lng,
        label,
        source,
        reverse: null,
        nearby: [],
      });
      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
        });
        const res = await fetch(`/api/places/search?${params}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          place?: ExternalPlace | null;
          nearby?: ExternalPlace[];
        };
        setWhatsHere((prev) =>
          prev
            ? {
                ...prev,
                reverse: data.place ?? null,
                nearby: data.nearby ?? [],
                label: data.place?.name ?? label,
              }
            : prev,
        );
      } catch {
        // keep stub card
      }
    },
    [patchState],
  );

  const onMapClick = useCallback(
    (target: MapClickTarget) => {
      if (target.type === "dogmarked") {
        selectPlace(target.place);
        return;
      }
      if (target.type === "contextual_poi") {
        void loadWhatsHere(
          target.lat,
          target.lng,
          target.name,
          "contextual_poi",
        );
        return;
      }
      void loadWhatsHere(target.lat, target.lng, "What’s here?", "empty");
    },
    [loadWhatsHere, selectPlace],
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
      setAreaMoved(false);
    } finally {
      setSearching(false);
    }
  }, [bbox]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      void (async () => {
        setSearchBusy(true);
        try {
          const params = new URLSearchParams({ q });
          if (searchKind !== "all") params.set("kind", searchKind);
          if (bbox) {
            params.set(
              "bbox",
              `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`,
            );
            params.set("lat", String((bbox.minLat + bbox.maxLat) / 2));
            params.set("lng", String((bbox.minLng + bbox.maxLng) / 2));
          }
          const res = await fetch(`/api/places/search?${params}`);
          if (!res.ok) {
            setSearchResults([]);
            return;
          }
          const data = (await res.json()) as { results?: ExternalPlace[] };
          setSearchResults(data.results ?? []);
        } finally {
          setSearchBusy(false);
        }
      })();
    }, 320);
  }, [searchQuery, searchKind, bbox]);

  useEffect(() => {
    if (!selectedSlug) setSheetOpen(false);
  }, [selectedSlug]);

  // XOR: never keep sheet open when desktop right panel is active
  useEffect(() => {
    if (isDesktopDetail) setSheetOpen(false);
    else if (selectedSlug) setSheetOpen(true);
  }, [isDesktopDetail, selectedSlug]);

  const activeFilterCount =
    state.filters.categories.length +
    state.filters.dogStatuses.length +
    (state.filters.query ? 1 : 0) +
    (state.filters.layer !== "all" ? 1 : 0);

  const detailCard = selected ? (
    <PlaceDetail
      place={selected}
      dogs={DEFAULT_DOG_PROFILES}
      onClose={() => patchState({ selectedSlug: null })}
    />
  ) : whatsHere ? (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted">What’s here?</p>
        <h2 className="font-display text-2xl text-ink">{whatsHere.label}</h2>
        <p className="mt-2 rounded-lg bg-foam px-3 py-2 text-sm text-muted">
          Contextual map place —{" "}
          <strong className="font-medium text-ink">not dog-friendly</strong> until
          Dogmarked has policy evidence.
        </p>
      </div>
      {whatsHere.reverse ? (
        <p className="text-sm text-muted">{whatsHere.reverse.formattedAddress}</p>
      ) : null}
      {whatsHere.nearby.length ? (
        <ul className="space-y-2 text-sm">
          <li className="text-xs uppercase tracking-[0.12em] text-muted">Nearby</li>
          {whatsHere.nearby.map((n) => (
            <li key={`${n.provider}:${n.externalId}`}>
              <button
                type="button"
                className="w-full rounded-lg border border-border px-3 py-2 text-left hover:bg-foam"
                onClick={() =>
                  setFlyTo({ lat: n.lat, lng: n.lng, zoom: 16 })
                }
              >
                <p className="font-medium text-ink">{n.name}</p>
                <p className="text-xs text-muted">{n.formattedAddress}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link
            href={`/add?lat=${whatsHere.lat}&lng=${whatsHere.lng}&name=${encodeURIComponent(whatsHere.label)}`}
          >
            Add custom place
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setWhatsHere(null)}>
          Dismiss
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex h-full flex-col justify-center gap-2 text-sm text-muted">
      <p className="font-display text-2xl text-ink">Explore the map</p>
      <p>
        Basemap places are neutral context. Dogmarked pins show verified dog
        policy only.
      </p>
    </div>
  );

  return (
    <div className="relative flex h-[calc(100dvh-0px)] flex-col xl:h-[calc(100dvh-var(--dm-header-h))]">
      {/* Search this area — top center after move */}
      {areaMoved && bbox ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center safe-pt">
          <Button
            size="sm"
            className="pointer-events-auto shadow-md"
            disabled={searching}
            onClick={() => void searchThisArea()}
          >
            {searching ? "Searching…" : "Search this area"}
          </Button>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 safe-pt safe-px xl:left-[var(--dm-panel-left)] xl:right-0">
        <div className="pointer-events-auto flex items-start justify-between gap-3 pt-3 xl:pr-4">
          <div className="rounded-2xl bg-card/90 px-4 py-3 shadow-sm backdrop-blur xl:hidden">
            <p className="font-display text-3xl leading-none text-teal-deep">Dogmarked</p>
            <p className="mt-1 max-w-[16rem] text-xs text-muted">
              Can you bring your dog—and under what conditions?
            </p>
          </div>
          <div className="ml-auto flex gap-2">
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
        <aside className="hidden w-[var(--dm-panel-left)] max-w-[400px] min-w-[360px] shrink-0 flex-col border-r border-border bg-card/90 md:flex">
          <div className="border-b border-border px-4 py-4">
            <h1 className="font-display text-3xl text-teal-deep">Explore</h1>
            <p className="mt-1 text-sm text-muted">
              Map-first discovery. Neutral POIs are not dog policy.
            </p>
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Search places or destinations…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search"
              />
              <div className="flex gap-1 text-xs">
                {(
                  [
                    ["all", "All"],
                    ["place", "Places"],
                    ["destination", "Destinations"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSearchKind(value)}
                    className={cn(
                      "rounded-md px-2 py-1",
                      searchKind === value
                        ? "bg-teal/15 text-teal-deep"
                        : "text-muted hover:bg-foam",
                    )}
                  >
                    {label}
                  </button>
                ))}
                {searchBusy ? <span className="ml-auto text-muted">…</span> : null}
              </div>
              {searchResults.length ? (
                <ul className="max-h-40 overflow-y-auto rounded-lg border border-border">
                  {searchResults.map((r) => (
                    <li key={`${r.provider}:${r.externalId}`}>
                      <button
                        type="button"
                        className="w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-foam"
                        onClick={() => {
                          setFlyTo({ lat: r.lat, lng: r.lng, zoom: r.kind === "destination" ? 11 : 15 });
                          void loadWhatsHere(r.lat, r.lng, r.name, "search");
                        }}
                      >
                        <p className="font-medium text-ink">{r.name}</p>
                        <p className="text-xs text-muted">
                          {r.kind === "destination" ? "Destination" : "Place"} ·{" "}
                          {r.formattedAddress}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">
              {visiblePlaces.length} Dogmarked places
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
                          {!place.policy ? " · no policy yet" : ""}
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
                No Dogmarked places match. Search the area or contribute a policy.
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
            flyTo={flyTo}
            onSelect={selectPlace}
            onMapClick={onMapClick}
            onBoundsChange={setBbox}
            onViewportChange={onViewportChange}
            className="absolute inset-0 h-full w-full"
          />
        </div>

        {/* Desktop ≥1280 right detail — XOR with mobile sheet */}
        <aside
          className={cn(
            "hidden w-[var(--dm-panel-right)] max-w-[440px] min-w-[400px] shrink-0 overflow-y-auto border-l border-border bg-card/95 p-4",
            "xl:block",
          )}
        >
          {detailCard}
        </aside>
      </div>

      {mobileView === "list" ? (
        <div className="min-h-0 flex-1 overflow-y-auto bg-card pb-24 md:hidden">
          <div className="safe-px border-b border-border py-4">
            <h1 className="font-display text-3xl text-teal-deep">Explore</h1>
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

      {/* Mobile / tablet sheet only — never with desktop panel */}
      {!isDesktopDetail ? (
        <Sheet
          open={sheetOpen && Boolean(selected || whatsHere)}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) {
              patchState({ selectedSlug: null });
              setWhatsHere(null);
            }
          }}
        >
          <SheetContent>
            {selected || whatsHere ? (
              <>
                <SheetHeader>
                  <SheetTitle className="sr-only">
                    {selected?.name ?? whatsHere?.label ?? "Place"}
                  </SheetTitle>
                </SheetHeader>
                {detailCard}
              </>
            ) : null}
          </SheetContent>
        </Sheet>
      ) : null}

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
