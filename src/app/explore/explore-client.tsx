"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { List, Map as MapIcon, Plus } from "lucide-react";
import type { MapClickTarget } from "@/components/map/map-view";
import {
  PlaceComposer,
  type ComposerDraft,
  type ComposerSavePayload,
} from "@/components/map/place-composer";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DOG_BADGES,
  categoryLabel,
  dbToCategory,
  type MvpSaveStatus,
} from "@/lib/mvp/taxonomy";
import type { ExternalPlace } from "@/lib/places/provider";
import { cn } from "@/lib/utils";

const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[var(--color-surface-muted)] text-sm text-[var(--color-text-muted)]">
        Loading map…
      </div>
    ),
  },
);

export type MySavePin = {
  placeId: string;
  slug: string;
  name: string;
  status: MvpSaveStatus;
  visibility: "private" | "public";
  privateNotes: string | null;
  dogBadges: string[];
  category: string;
  lat: number;
  lng: number;
  city: string | null;
  address: string | null;
  website: string | null;
};

type PublicPin = {
  saveId: string;
  placeId: string;
  slug: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  city: string | null;
  address: string | null;
  status: MvpSaveStatus;
  dogBadges: string[];
  savedBy: { handle: string; displayName: string };
};

type AroundHere = {
  lat: number;
  lng: number;
  label: string;
  nearby: ExternalPlace[];
};

type Preview =
  | { kind: "mine"; pin: MySavePin }
  | { kind: "others"; pin: PublicPin };

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function ExploreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const overlayOthers = searchParams.get("overlay") === "others";
  const urlQuery = searchParams.get("q") ?? "";

  const [view, setView] = useState<"map" | "list">("map");
  const [statusTab, setStatusTab] = useState<"all" | MvpSaveStatus>("all");
  const [mySaves, setMySaves] = useState<MySavePin[]>([]);
  const [publicPins, setPublicPins] = useState<PublicPin[]>([]);
  const [bbox, setBbox] = useState<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
  const [around, setAround] = useState<AroundHere | null>(null);
  const [composer, setComposer] = useState<ComposerDraft | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [searchHits, setSearchHits] = useState<ExternalPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    null,
  );
  const [isDesktop, setIsDesktop] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const loadMySaves = useCallback(async () => {
    try {
      const res = await fetch("/api/saves");
      if (res.status === 401) {
        setSignedIn(false);
        setMySaves([]);
        return;
      }
      setSignedIn(true);
      const json = (await res.json()) as { saves?: MySavePin[]; error?: string };
      if (res.ok) setMySaves(json.saves ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadMySaves();
  }, [loadMySaves]);

  useEffect(() => {
    if (!overlayOthers || !bbox) {
      setPublicPins([]);
      return;
    }
    const qs = new URLSearchParams({
      minLng: String(bbox.minLng),
      minLat: String(bbox.minLat),
      maxLng: String(bbox.maxLng),
      maxLat: String(bbox.maxLat),
    });
    void fetch(`/api/saves/public?${qs}`)
      .then((r) => r.json())
      .then((j: { pins?: PublicPin[] }) => setPublicPins(j.pins ?? []))
      .catch(() => setPublicPins([]));
  }, [overlayOthers, bbox]);

  useEffect(() => {
    if (urlQuery.trim().length < 3) {
      setSearchHits([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/places/search?q=${encodeURIComponent(urlQuery)}`)
        .then((r) => r.json())
        .then((j: { results?: ExternalPlace[] }) => setSearchHits(j.results ?? []))
        .catch(() => setSearchHits([]));
    }, 280);
    return () => clearTimeout(t);
  }, [urlQuery]);

  const listPins = useMemo(() => {
    let rows = mySaves;
    if (statusTab !== "all") rows = rows.filter((p) => p.status === statusTab);
    return rows;
  }, [mySaves, statusTab]);

  const mapPlaces = useMemo(() => {
    const mine = mySaves.map((p) => ({
      id: p.placeId,
      name: p.name,
      slug: p.slug,
      category: p.category as MySavePin["category"],
      lat: p.lat,
      lng: p.lng,
      countryCode: "US",
      city: p.city,
      address: p.address,
      status: "active" as const,
      policy: null,
      saveLayer: "mine" as const,
      saveStatus: p.status,
    }));
    const others = publicPins.map((p) => ({
      id: `pub-${p.saveId}`,
      name: p.name,
      slug: p.slug,
      category: p.category as MySavePin["category"],
      lat: p.lat,
      lng: p.lng,
      countryCode: "US",
      city: p.city,
      address: p.address,
      status: "active" as const,
      policy: null,
      saveLayer: "others" as const,
      saveStatus: p.status,
    }));
    return overlayOthers ? [...mine, ...others] : mine;
  }, [mySaves, publicPins, overlayOthers]);

  const candidatePlaces = useMemo(() => {
    if (!around) return [];
    return around.nearby.slice(0, 10).map((n, i) => ({
      id: `cand-${i}-${n.externalId}`,
      name: n.name,
      slug: `candidate-${i}`,
      category: "other" as const,
      lat: n.lat,
      lng: n.lng,
      countryCode: n.countryCode,
      city: null,
      address: n.formattedAddress,
      status: "active" as const,
      policy: null,
      saveLayer: "candidate" as const,
      saveStatus: "want_to_go" as const,
    }));
  }, [around]);

  async function openAround(lat: number, lng: number, label?: string) {
    setPreview(null);
    setComposer(null);
    setAround({ lat, lng, label: label ?? "Selected point", nearby: [] });
    setFlyTo({ lat, lng, zoom: 16 });
    try {
      const res = await fetch(`/api/places/search?lat=${lat}&lng=${lng}`);
      const json = (await res.json()) as {
        place?: ExternalPlace | null;
        nearby?: ExternalPlace[];
      };
      setAround({
        lat,
        lng,
        label: label ?? json.place?.name ?? "Around here",
        nearby: json.nearby ?? (json.place ? [json.place] : []),
      });
    } catch {
      setAround({ lat, lng, label: label ?? "Around here", nearby: [] });
    }
  }

  function onMapClick(target: MapClickTarget) {
    if (target.type === "dogmarked") {
      const mine = mySaves.find((p) => p.slug === target.place.slug);
      if (mine) {
        setAround(null);
        setComposer(null);
        setPreview({ kind: "mine", pin: mine });
        return;
      }
      const pub = publicPins.find((p) => p.slug === target.place.slug);
      if (pub) {
        setAround(null);
        setComposer(null);
        setPreview({ kind: "others", pin: pub });
        return;
      }
      void openAround(target.place.lat, target.place.lng, target.place.name);
      return;
    }
    if (target.type === "contextual_poi") {
      void openAround(target.lat, target.lng, target.name);
      return;
    }
    void openAround(target.lat, target.lng);
  }

  function startComposerFromCandidate(place: ExternalPlace) {
    setAround(null);
    setComposer({
      name: place.name,
      address: place.formattedAddress,
      lat: place.lat,
      lng: place.lng,
      category: dbToCategory(place.category),
    });
  }

  function startCustomComposer() {
    if (!around) return;
    setComposer({
      name: around.label === "Around here" ? "Custom place" : around.label,
      lat: around.lat,
      lng: around.lng,
    });
    setAround(null);
  }

  async function saveComposer(payload: ComposerSavePayload) {
    if (!signedIn) {
      router.push("/login?next=/explore");
      throw new Error("Sign in to save places.");
    }
    setBusy(true);
    try {
      let placeId = payload.placeId;
      if (!placeId) {
        const createRes = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name,
            category: payload.category === "food_drink" ? "restaurant" : payload.category,
            lat: payload.lat,
            lng: payload.lng,
            address: payload.address ?? null,
            city: payload.city ?? null,
            countryCode: "US",
          }),
        });
        const createJson = (await createRes.json()) as {
          place?: { id: string; slug: string };
          error?: string;
        };
        if (!createRes.ok || !createJson.place) {
          throw new Error(
            typeof createJson.error === "string"
              ? createJson.error
              : "Could not create place.",
          );
        }
        placeId = createJson.place.id;
      }

      const saveRes = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          status: payload.status,
          visibility: payload.visibility,
          privateNotes: payload.note || null,
          dogBadges: payload.dogBadges,
          category: payload.category === "food_drink" ? "restaurant" : payload.category,
        }),
      });
      const saveJson = (await saveRes.json()) as { error?: string; message?: string };
      if (!saveRes.ok) {
        throw new Error(saveJson.error ?? "Could not save.");
      }
      setComposer(null);
      setToast(saveJson.message ?? "Saved to your map.");
      await loadMySaves();
    } finally {
      setBusy(false);
    }
  }

  const sheetOpen = Boolean(around || composer || preview);
  const drawerContent = composer ? (
    <PlaceComposer
      draft={composer}
      busy={busy}
      onClose={() => setComposer(null)}
      onSave={saveComposer}
    />
  ) : around ? (
    <AroundHerePanel
      around={around}
      onClose={() => setAround(null)}
      onSelect={startComposerFromCandidate}
      onCustom={startCustomComposer}
    />
  ) : preview ? (
    <PreviewPanel
      preview={preview}
      onClose={() => setPreview(null)}
      onEdit={
        preview.kind === "mine"
          ? () => {
              setComposer({
                name: preview.pin.name,
                address: preview.pin.address,
                city: preview.pin.city,
                lat: preview.pin.lat,
                lng: preview.pin.lng,
                category: dbToCategory(preview.pin.category),
                placeId: preview.pin.placeId,
                slug: preview.pin.slug,
              });
              setPreview(null);
            }
          : undefined
      }
    />
  ) : null;

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem-3.25rem)] flex-col sm:h-[calc(100dvh-4rem)] xl:h-[calc(100dvh-4rem)]">
      {/* Map / List toggle + Add */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center gap-2 px-3">
        <div className="pointer-events-auto flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 shadow-md">
          <button
            type="button"
            onClick={() => setView("map")}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold",
              view === "map"
                ? "bg-[var(--color-brand-600)] text-white"
                : "text-[var(--color-text-muted)]",
            )}
          >
            <MapIcon className="h-4 w-4" /> Map
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold",
              view === "list"
                ? "bg-[var(--color-brand-600)] text-white"
                : "text-[var(--color-text-muted)]",
            )}
          >
            <List className="h-4 w-4" /> List
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          const center = bbox
            ? {
                lat: (bbox.minLat + bbox.maxLat) / 2,
                lng: (bbox.minLng + bbox.maxLng) / 2,
              }
            : { lat: 26.05, lng: -80.14 };
          setComposer({
            name: "",
            lat: center.lat,
            lng: center.lng,
          });
          setAround(null);
          setPreview(null);
        }}
        className="pointer-events-auto absolute bottom-6 right-4 z-20 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-accent-500)] px-5 text-sm font-semibold text-white shadow-lg transition-transform duration-150 hover:scale-[1.02] xl:bottom-8"
      >
        <Plus className="h-5 w-5" /> Add a place
      </button>

      {view === "map" ? (
        <div className="relative min-h-0 flex-1">
          <MapView
            places={[...mapPlaces, ...candidatePlaces] as never}
            selectedSlug={preview?.kind === "mine" ? preview.pin.slug : null}
            flyTo={flyTo}
            onMapClick={onMapClick}
            onBoundsChange={setBbox}
            className="h-full w-full"
          />

          {searchHits.length > 0 ? (
            <div className="absolute left-3 top-16 z-20 max-h-64 w-[min(100%-1.5rem,22rem)] overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
              {searchHits.map((hit) => (
                <button
                  key={`${hit.provider}-${hit.externalId}`}
                  type="button"
                  className="block w-full border-b border-[var(--color-border)] px-4 py-3 text-left last:border-0 hover:bg-[var(--color-surface-muted)]"
                  onClick={() => {
                    setSearchHits([]);
                    setFlyTo({ lat: hit.lat, lng: hit.lng, zoom: 15 });
                    setComposer({
                      name: hit.name,
                      address: hit.formattedAddress,
                      lat: hit.lat,
                      lng: hit.lng,
                      category: dbToCategory(hit.category),
                    });
                  }}
                >
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{hit.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {hit.category ?? "Place"}
                    {hit.formattedAddress ? ` · ${hit.formattedAddress}` : ""}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {isDesktop && sheetOpen ? (
            <aside className="absolute bottom-0 right-0 top-0 z-30 w-[min(100%,420px)] border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
              {drawerContent}
            </aside>
          ) : null}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-[var(--color-canvas)] px-4 pb-28 pt-16">
          <div className="mx-auto max-w-lg space-y-3">
            <div className="flex gap-2">
              {(
                [
                  ["all", "All"],
                  ["want_to_go", "Want to go"],
                  ["been_there", "Been there"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusTab(id)}
                  className={cn(
                    "min-h-10 rounded-full px-3 text-sm font-semibold",
                    statusTab === id
                      ? "bg-[var(--color-brand-600)] text-white"
                      : "bg-white text-[var(--color-text-muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {!signedIn ? (
              <EmptyCard
                title="Sign in to build your map"
                body="Save hotels, parks, and cafés with a quick note and dog badges."
                actionLabel="Sign in"
                onAction={() => router.push("/login?next=/explore")}
              />
            ) : listPins.length === 0 ? (
              <EmptyCard
                title="Your map is empty"
                body="Tap the map, pick a nearby place, and save your first pin."
                actionLabel="Add a place"
                onAction={() => setView("map")}
              />
            ) : (
              listPins.map((pin) => (
                <button
                  key={pin.placeId}
                  type="button"
                  className="flex w-full gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left shadow-sm"
                  onClick={() => {
                    setView("map");
                    setFlyTo({ lat: pin.lat, lng: pin.lng, zoom: 15 });
                    setPreview({ kind: "mine", pin });
                  }}
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-xs font-semibold text-[var(--color-text-muted)]">
                    {categoryLabel(dbToCategory(pin.category)).slice(0, 4)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--color-ink)]">{pin.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {pin.status === "been_there" ? "Been there" : "Want to go"}
                      {pin.city ? ` · ${pin.city}` : ""}
                    </p>
                    {pin.dogBadges.length ? (
                      <p className="mt-1 truncate text-xs text-[var(--color-brand-600)]">
                        {pin.dogBadges.length} dog badge
                        {pin.dogBadges.length === 1 ? "" : "s"}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Dog access not documented yet.
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {!isDesktop && sheetOpen ? (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) {
              setAround(null);
              setComposer(null);
              setPreview(null);
            }
          }}
        >
          <SheetContent className="rounded-t-[20px] border-[var(--color-border)] bg-[var(--color-surface)]">
            <SheetHeader className="sr-only">
              <SheetTitle>Place</SheetTitle>
            </SheetHeader>
            {drawerContent}
          </SheetContent>
        </Sheet>
      ) : null}

      {toast ? (
        <div className="absolute bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
          <button type="button" className="ml-3 underline" onClick={() => setToast(null)}>
            OK
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AroundHerePanel({
  around,
  onClose,
  onSelect,
  onCustom,
}: {
  around: AroundHere;
  onClose: () => void;
  onSelect: (p: ExternalPlace) => void;
  onCustom: () => void;
}) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Around here
          </p>
          <h2 className="font-display text-2xl text-[var(--color-ink)]">{around.label}</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {around.nearby.length === 0 ? (
          <li className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
            No nearby places found. Create a custom pin at this point.
          </li>
        ) : (
          around.nearby.slice(0, 10).map((place) => {
            const meters = haversineM(
              { lat: around.lat, lng: around.lng },
              { lat: place.lat, lng: place.lng },
            );
            return (
              <li key={`${place.provider}-${place.externalId}`}>
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  className="flex w-full gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3 text-left hover:border-[var(--color-brand-500)]"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--color-sand)] text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                    {(place.category ?? "poi").slice(0, 4)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{place.name}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {place.category ?? "Place"}
                      {place.formattedAddress ? ` · ${place.formattedAddress}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--color-brand-600)]">
                      {meters < 1000
                        ? `${Math.round(meters)} m away`
                        : `${(meters / 1000).toFixed(1)} km away`}
                    </p>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
      <Button
        type="button"
        className="mt-4 min-h-12 rounded-[10px] bg-[var(--color-accent-500)] font-semibold text-white hover:bg-[var(--color-accent-600)]"
        onClick={onCustom}
      >
        Create a custom place here
      </Button>
    </div>
  );
}

function PreviewPanel({
  preview,
  onClose,
  onEdit,
}: {
  preview: Preview;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const pin = preview.pin;
  const badges = pin.dogBadges
    .map((id) => DOG_BADGES.find((b) => b.id === id)?.label)
    .filter(Boolean);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {categoryLabel(dbToCategory(pin.category))}
            {pin.city ? ` · ${pin.city}` : ""}
          </p>
          <h2 className="font-display text-2xl text-[var(--color-ink)]">{pin.name}</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mb-4 flex h-40 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] text-sm text-[var(--color-text-muted)]">
        Photo coming soon
      </div>
      <p className="text-sm font-semibold text-[var(--color-brand-600)]">
        {pin.status === "been_there" ? "Been there" : "Want to go"}
      </p>
      {preview.kind === "others" ? (
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Saved by {preview.pin.savedBy.displayName} (@{preview.pin.savedBy.handle})
        </p>
      ) : null}
      {pin.address ? (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{pin.address}</p>
      ) : null}
      <div className="mt-4">
        <p className="text-sm font-semibold">Dog access</p>
        {badges.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {badges.map((label) => (
              <span
                key={label}
                className="rounded-full bg-[var(--color-brand-100)] px-3 py-1 text-xs font-medium text-[var(--color-brand-700)]"
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Dog access not documented yet.
          </p>
        )}
      </div>
      {preview.kind === "mine" && preview.pin.privateNotes ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">Your note</p>
          <p className="mt-1 text-sm text-[var(--color-text)]">{preview.pin.privateNotes}</p>
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        {onEdit ? (
          <Button type="button" onClick={onEdit} className="min-h-11 rounded-[10px]">
            Edit
          </Button>
        ) : null}
        {"website" in pin && pin.website ? (
          <Button asChild variant="outline" className="min-h-11 rounded-[10px]">
            <a href={pin.website} target="_blank" rel="noopener noreferrer">
              Website
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EmptyCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
      <h3 className="font-display text-xl text-[var(--color-ink)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{body}</p>
      <Button
        type="button"
        className="mt-4 min-h-11 rounded-[10px] bg-[var(--color-accent-500)]"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
