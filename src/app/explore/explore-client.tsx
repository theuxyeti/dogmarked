"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Map as MapIcon, Plus, X } from "lucide-react";
import type { MapClickTarget, MapViewApi } from "@/components/map/map-view";
import {
  PlaceComposer,
  type ComposerDraft,
  type ComposerSavePayload,
} from "@/components/map/place-composer";
import { PlacePreviewCard } from "@/components/map/place-preview-card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { categoryEmoji } from "@/lib/discovery/category-icons";
import { renderedPoisToCandidates } from "@/lib/discovery/maptiler-fallback";
import {
  DEFAULT_RADIUS_M,
  RADIUS_PRESETS_M,
  type NearbyDiscoveryResponse,
  type PlaceCandidate,
  type PlaceDetails,
  type PlacePhoto,
  type PlaceTip,
} from "@/lib/discovery/types";
import {
  exploreMapPadding,
  localityZoom,
  placeFocusZoom,
} from "@/lib/map/camera";
import {
  passesDogFriendlyFilter,
  resolveMarkerPolicyStatus,
  type DogFriendlyFilterMode,
  type MarkerShellStatus,
} from "@/lib/map/marker-policy";
import {
  categoryLabel,
  categoryToDb,
  dbToCategory,
  type MvpCategoryId,
  type MvpSaveStatus,
} from "@/lib/mvp/taxonomy";
import type { PlaceLink } from "@/lib/place-links";
import {
  LOCAL_PETS_STORAGE_KEY,
  activePackAsDogs,
  dogProfileToLocalPet,
} from "@/lib/pets";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { ExternalPlace } from "@/lib/places/provider";
import type { DogProfile, PetProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  {
    ssr: false,
    // Streets-like fallback only for the first client chunk load — never a cream blank.
    loading: () => (
      <div
        className="h-full w-full"
        style={{
          background:
            "linear-gradient(180deg, #dce8e4 0%, #c5d5cf 45%, #b7c9c2 100%)",
        }}
        aria-label="Loading map"
      />
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

type NearbySession = {
  lat: number;
  lng: number;
  label: string;
  radiusMeters: number;
  candidates: PlaceCandidate[];
  discoveryAvailable: boolean;
  /** loading | success | empty | failure | config */
  status: "loading" | "success" | "empty" | "failure" | "config" | "auth";
  message?: string;
  errorCode?: string;
  usedFallback?: boolean;
};

function formatDistance(m?: number) {
  if (m == null || !Number.isFinite(m)) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function isLocalityLike(hit: ExternalPlace) {
  return hit.resultKind === "locality" || hit.resultKind === "region";
}

export function ExploreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showMine = searchParams.get("mine") !== "0";
  const showCommunity =
    searchParams.get("community") === "1" ||
    searchParams.get("overlay") === "others";
  const showDiscover = searchParams.get("discover") !== "0";
  const urlQuery = searchParams.get("q") ?? "";

  const [view, setView] = useState<"map" | "list">("map");
  const [statusTab, setStatusTab] = useState<"all" | MvpSaveStatus>("all");
  /** Default: include unknown places (discovery). Never uses Foursquare friendliness. */
  const [dogFriendlyFilter, setDogFriendlyFilter] =
    useState<DogFriendlyFilterMode>("include_unknown");
  const [mySaves, setMySaves] = useState<MySavePin[]>([]);
  const [publicPins, setPublicPins] = useState<PublicPin[]>([]);
  const [bbox, setBbox] = useState<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
  const [nearby, setNearby] = useState<NearbySession | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<PlaceCandidate | null>(
    null,
  );
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [tips, setTips] = useState<PlaceTip[]>([]);
  const [tipsEnabled, setTipsEnabled] = useState(false);
  const [placeLinks, setPlaceLinks] = useState<PlaceLink[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [composer, setComposer] = useState<ComposerDraft | null>(null);
  const [previewMine, setPreviewMine] = useState<MySavePin | null>(null);
  const [searchHits, setSearchHits] = useState<ExternalPlace[]>([]);
  const [chooseLocation, setChooseLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    null,
  );
  const [isDesktop, setIsDesktop] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [pets, setPets] = useState<PetProfile[]>(() =>
    DEFAULT_DOG_PROFILES.map((d) => dogProfileToLocalPet(d)),
  );
  const activeDogs = useMemo<DogProfile[]>(
    () => {
      const pack = activePackAsDogs(pets);
      return pack.length ? pack : DEFAULT_DOG_PROFILES;
    },
    [pets],
  );

  const abortRef = useRef<AbortController | null>(null);
  const enrichAbortRef = useRef<AbortController | null>(null);
  const publicSavesAbortRef = useRef<AbortController | null>(null);
  const lastPublicSavesQsRef = useRef<string | null>(null);
  const bboxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapApiRef = useRef<MapViewApi | null>(null);
  /** After a destination is chosen, ignore the next urlQuery-driven autocomplete fetch. */
  const suppressAutocompleteRef = useRef(false);

  const onBoundsChange = useCallback(
    (next: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    }) => {
      // Debounce camera settle — never setBbox on every moveend pixel.
      if (bboxDebounceRef.current != null) clearTimeout(bboxDebounceRef.current);
      bboxDebounceRef.current = setTimeout(() => {
        bboxDebounceRef.current = null;
        setBbox((prev) => {
          if (
            prev &&
            prev.minLng === next.minLng &&
            prev.minLat === next.minLat &&
            prev.maxLng === next.maxLng &&
            prev.maxLat === next.maxLat
          ) {
            return prev;
          }
          return next;
        });
      }, 400);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (bboxDebounceRef.current != null) clearTimeout(bboxDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Active pack for place-card compatibility (local first, then /api/pets when signed in)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_PETS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PetProfile[];
        if (Array.isArray(parsed) && parsed.length) setPets(parsed);
      }
    } catch {
      /* keep defaults */
    }

    void fetch("/api/pets")
      .then((r) => r.json())
      .then((j: { pets?: PetProfile[]; ok?: boolean }) => {
        if (Array.isArray(j.pets) && j.pets.length) {
          setPets(j.pets);
          try {
            localStorage.setItem(LOCAL_PETS_STORAGE_KEY, JSON.stringify(j.pets));
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        /* guest / offline — DEFAULT_DOG_PROFILES */
      });
  }, []);

  // Hydrate layer prefs for signed-in users (per-account, not leaked across users)
  useEffect(() => {
    void fetch("/api/map-preferences")
      .then((r) => r.json())
      .then(
        (j: {
          showMyPlaces?: boolean;
          showCommunity?: boolean;
          authenticated?: boolean;
        }) => {
          if (!j.authenticated) return;
          const params = new URLSearchParams(searchParams.toString());
          let changed = false;
          if (j.showMyPlaces === false && params.get("mine") !== "0") {
            params.set("mine", "0");
            changed = true;
          }
          if (j.showCommunity === true && params.get("community") !== "1") {
            params.set("community", "1");
            changed = true;
          }
          if (changed) {
            params.delete("overlay");
            router.replace(`/explore?${params.toString()}`);
          }
        },
      )
      .catch(() => {
        /* ignore */
      });
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const json = (await res.json()) as { saves?: MySavePin[] };
      if (res.ok) setMySaves(json.saves ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadMySaves();
  }, [loadMySaves]);

  useEffect(() => {
    if (!showCommunity) {
      publicSavesAbortRef.current?.abort();
      lastPublicSavesQsRef.current = null;
      setPublicPins([]);
      return;
    }
    if (!bbox) {
      setPublicPins([]);
      return;
    }
    // Round to ~11m so sub-pixel camera jitter does not mint unique URLs.
    const round = (n: number) => n.toFixed(4);
    const qs = new URLSearchParams({
      minLng: round(bbox.minLng),
      minLat: round(bbox.minLat),
      maxLng: round(bbox.maxLng),
      maxLat: round(bbox.maxLat),
    }).toString();
    if (lastPublicSavesQsRef.current === qs) return;

    publicSavesAbortRef.current?.abort();
    const ac = new AbortController();
    publicSavesAbortRef.current = ac;

    void fetch(`/api/saves/public?${qs}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((j: { pins?: PublicPin[] }) => {
        if (ac.signal.aborted) return;
        lastPublicSavesQsRef.current = qs;
        setPublicPins(j.pins ?? []);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        if (!ac.signal.aborted) setPublicPins([]);
      });

    return () => {
      ac.abort();
    };
  }, [showCommunity, bbox]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchHits([]);
    }
    function onPointer(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[aria-label="Search suggestions"]')) return;
      if (t?.closest?.('form') && t.closest("header")) return;
      // Outside clicks close suggestions without clearing the committed query.
      if (searchHits.length) setSearchHits([]);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [searchHits.length]);

  useEffect(() => {
    if (suppressAutocompleteRef.current) {
      suppressAutocompleteRef.current = false;
      setSearchHits([]);
      return;
    }
    const q = urlQuery.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      void fetch(`/api/places/search?q=${encodeURIComponent(q)}`, {
        signal: ac.signal,
      })
        .then((r) => r.json())
        .then((j: { results?: ExternalPlace[] }) => {
          if (!ac.signal.aborted) setSearchHits(j.results ?? []);
        })
        .catch(() => {
          if (!ac.signal.aborted) setSearchHits([]);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [urlQuery]);

  const applyMaptilerFallback = useCallback(
    (lat: number, lng: number, radiusMeters: number): PlaceCandidate[] => {
      const api = mapApiRef.current;
      if (!api) return [];
      const hits = api.queryRenderedPoisAround(lat, lng, radiusMeters);
      return renderedPoisToCandidates(hits, { lat, lng }, radiusMeters);
    },
    [],
  );

  const runNearby = useCallback(
    async (
      lat: number,
      lng: number,
      radiusMeters: number,
      label?: string,
      opts?: { resultKind?: string | null; zoom?: number },
    ) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setSelectedCandidate(null);
      setDetails(null);
      setPhotos([]);
      setTips([]);
      setPlaceLinks([]);
      setComposer(null);
      setPreviewMine(null);
      setNearbyLoading(true);
      const title = label?.trim() || "this place";
      // Keep prior candidates visible until replacement arrives — never blank the map.
      setNearby((prev) => ({
        lat,
        lng,
        label: title,
        radiusMeters,
        candidates: prev?.candidates ?? [],
        discoveryAvailable: true,
        status: "loading",
        message: `Finding places around ${title}…`,
      }));
      setFlyTo({
        lat,
        lng,
        zoom: opts?.zoom ?? localityZoom(opts?.resultKind),
      });

      try {
        const qs = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          radius: String(radiusMeters),
        });
        const res = await fetch(`/api/discovery/nearby?${qs}`, { signal: ac.signal });
        const json = (await res.json()) as NearbyDiscoveryResponse & {
          message?: string;
          error?: string;
        };
        if (ac.signal.aborted) return;

        if (res.status === 401) {
          setSignedIn(false);
        } else if (res.ok) {
          setSignedIn(true);
        }

        let candidates = json.candidates ?? [];
        let usedFallback = Boolean(json.usedFallback);
        const providerFailed =
          (!res.ok && !usedFallback) ||
          (json.discoveryAvailable === false && candidates.length === 0) ||
          (Boolean(json.discoveryError) && candidates.length === 0 && !usedFallback);

        if (candidates.length === 0) {
          // Wait for map idle so flyTo tiles/POI labels are queryable.
          try {
            await mapApiRef.current?.whenIdle?.(2000);
          } catch {
            /* ignore */
          }
          if (ac.signal.aborted) return;
          const fallback = applyMaptilerFallback(lat, lng, radiusMeters);
          if (fallback.length > 0) {
            candidates = fallback;
            usedFallback = true;
          }
        }

        const resolvedLabel = label?.trim() || json.label || title;
        if (candidates.length > 0) {
          setNearby({
            lat,
            lng,
            label: resolvedLabel,
            radiusMeters: json.radiusMeters ?? radiusMeters,
            candidates,
            discoveryAvailable: true,
            status: "success",
            usedFallback,
            errorCode: json.discoveryError?.code,
            message: usedFallback
              ? json.discoveryError
                ? `Showing map places while discovery recovers (${json.discoveryError.code}).`
                : "Showing places from the map while place discovery recovers."
              : undefined,
          });
          const pad = exploreMapPadding({
            drawerOpen: true,
            isDesktop: typeof window !== "undefined" && window.innerWidth >= 1280,
          });
          requestAnimationFrame(() => {
            mapApiRef.current?.fitNearby(
              [{ lat, lng }, ...candidates.map((c) => ({ lat: c.latitude, lng: c.longitude }))],
              pad,
            );
          });
          return;
        }

        if (providerFailed || json.discoveryError || !res.ok) {
          const code = json.discoveryError?.code ?? (res.status === 401 ? "AUTH_REQUIRED" : undefined);
          setNearby({
            lat,
            lng,
            label: resolvedLabel,
            radiusMeters: json.radiusMeters ?? radiusMeters,
            candidates: [],
            discoveryAvailable: false,
            status:
              code === "PROVIDER_NOT_CONFIGURED"
                ? "config"
                : code === "AUTH_REQUIRED"
                  ? "auth"
                  : "failure",
            errorCode: code,
            message:
              json.message ??
              json.discoveryError?.message ??
              "We couldn’t reach place discovery right now. Try again or create a custom place.",
          });
          return;
        }

        setNearby({
          lat,
          lng,
          label: resolvedLabel,
          radiusMeters: json.radiusMeters ?? radiusMeters,
          candidates: [],
          discoveryAvailable: true,
          status: "empty",
          message: `No listed places were found within ${json.radiusMeters ?? radiusMeters} m. Try a larger radius or create a custom place.`,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        try {
          await mapApiRef.current?.whenIdle?.(2000);
        } catch {
          /* ignore */
        }
        const fallback = applyMaptilerFallback(lat, lng, radiusMeters);
        const code = fallback.length > 0 ? "PROVIDER_UNAVAILABLE" : "MAPTILER_FAILED";
        setNearby({
          lat,
          lng,
          label: title,
          radiusMeters,
          candidates: fallback,
          discoveryAvailable: fallback.length > 0,
          status: fallback.length ? "success" : "failure",
          usedFallback: fallback.length > 0,
          message: fallback.length
            ? `Showing places from the map while place discovery recovers (${code}).`
            : `We couldn’t reach place discovery right now. Try again or create a custom place. (${code})`,
          errorCode: code,
        });
      } finally {
        if (!ac.signal.aborted) setNearbyLoading(false);
      }
    },
    [applyMaptilerFallback],
  );

  async function enrichCandidate(candidate: PlaceCandidate) {
    enrichAbortRef.current?.abort();
    const ac = new AbortController();
    enrichAbortRef.current = ac;
    setSelectedCandidate(candidate);
    setDetails(null);
    setPhotos([]);
    setTips([]);
    setTipsEnabled(false);
    setPlaceLinks([]);

    const dogmarkedPlaceId = candidate.canonicalId;
    if (dogmarkedPlaceId) {
      void fetch(`/api/place-links?placeId=${encodeURIComponent(dogmarkedPlaceId)}`, {
        signal: ac.signal,
      })
        .then((r) => r.json())
        .then((j: { links?: PlaceLink[] }) => {
          if (!ac.signal.aborted) setPlaceLinks(j.links ?? []);
        })
        .catch(() => {
          if (!ac.signal.aborted) setPlaceLinks([]);
        });
    }

    if (candidate.provider !== "foursquare") {
      // Try resolve MapTiler → FSQ
      if (candidate.provider === "maptiler") {
        try {
          const res = await fetch("/api/discovery/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: candidate.name,
              latitude: candidate.latitude,
              longitude: candidate.longitude,
              address: candidate.formattedAddress,
            }),
            signal: ac.signal,
          });
          if (!res.ok) {
            /* soft-fail: keep MapTiler candidate */
          } else {
            const json = (await res.json()) as { candidate?: PlaceCandidate | null };
            if (json.candidate) {
              candidate = json.candidate;
              setSelectedCandidate(candidate);
            }
          }
        } catch {
          /* save without enrichment */
        }
      }
    }

    if (candidate.provider !== "foursquare") return;

    setDetailsLoading(true);
    try {
      const res = await fetch(
        `/api/discovery/provider/${encodeURIComponent(candidate.externalId)}`,
        { signal: ac.signal },
      );
      const json = (await res.json()) as {
        details?: PlaceDetails | null;
        enrichment?: { photosEnabled?: boolean; tipsEnabled?: boolean };
      };
      if (ac.signal.aborted) return;
      if (json.details) setDetails(json.details);

      const photosOk = json.enrichment?.photosEnabled !== false;
      // Tips default off (FSQ_TIPS_ENABLED=false) — only show when explicitly enabled
      const tipsOk = json.enrichment?.tipsEnabled === true;

      setTipsEnabled(tipsOk);
      setPhotosLoading(photosOk);
      setTipsLoading(tipsOk);

      await Promise.all([
        photosOk
          ? fetch(
              `/api/discovery/provider/${encodeURIComponent(candidate.externalId)}/photos`,
              { signal: ac.signal },
            )
              .then((r) => r.json())
              .then((j: { photos?: PlacePhoto[] }) => {
                if (!ac.signal.aborted) setPhotos(j.photos ?? []);
              })
              .catch(() => {
                if (!ac.signal.aborted) setPhotos([]);
              })
              .finally(() => {
                if (!ac.signal.aborted) setPhotosLoading(false);
              })
          : Promise.resolve().then(() => setPhotosLoading(false)),
        tipsOk
          ? fetch(
              `/api/discovery/provider/${encodeURIComponent(candidate.externalId)}/tips`,
              { signal: ac.signal },
            )
              .then((r) => r.json())
              .then((j: { tips?: PlaceTip[] }) => {
                if (!ac.signal.aborted) setTips(j.tips ?? []);
              })
              .catch(() => {
                if (!ac.signal.aborted) setTips([]);
              })
              .finally(() => {
                if (!ac.signal.aborted) setTipsLoading(false);
              })
          : Promise.resolve().then(() => setTipsLoading(false)),
      ]);
    } catch {
      /* keep lightweight candidate */
    } finally {
      if (!ac.signal.aborted) setDetailsLoading(false);
    }
  }

  function onMapClick(target: MapClickTarget) {
    // Saved Dogmarked pin
    if (target.type === "dogmarked") {
      const mine = mySaves.find((p) => p.slug === target.place.slug);
      if (mine) {
        setNearby(null);
        setSelectedCandidate(null);
        setComposer(null);
        setPreviewMine(mine);
        return;
      }
      const cand = nearby?.candidates.find(
        (c) =>
          c.externalId === target.place.id ||
          c.slug === target.place.slug ||
          `cand-${c.externalId}` === target.place.id ||
          target.place.id === `cand-${c.externalId}`,
      );
      if (cand) {
        void enrichCandidate(cand);
        return;
      }
    }

    // Candidate pin click while nearby session open
    if (target.type === "dogmarked" && nearby) {
      const cand = nearby.candidates.find(
        (c) => target.place.id === `cand-${c.externalId}`,
      );
      if (cand) {
        void enrichCandidate(cand);
        return;
      }
    }

    // Explicit choose-location, empty map click, or basemap POI → nearby discovery
    if (
      chooseLocation ||
      target.type === "empty" ||
      target.type === "contextual_poi"
    ) {
      setChooseLocation(false);
      const lat =
        target.type === "dogmarked" ? target.place.lat : target.lat;
      const lng =
        target.type === "dogmarked" ? target.place.lng : target.lng;
      const label =
        target.type === "contextual_poi"
          ? target.name
          : nearby?.label && nearby.label !== "this place"
            ? nearby.label
            : undefined;
      void runNearby(lat, lng, nearby?.radiusMeters ?? DEFAULT_RADIUS_M, label);
    }
  }

  function startCustomComposer() {
    if (!nearby) return;
    setComposer({
      name: nearby.label === "Around here" ? "Custom place" : nearby.label,
      lat: nearby.lat,
      lng: nearby.lng,
    });
    setSelectedCandidate(null);
  }

  function openComposerFromCandidate() {
    if (!selectedCandidate) return;
    const d = details;
    const mine = selectedCandidate.canonicalId
      ? mySaves.find((s) => s.placeId === selectedCandidate.canonicalId)
      : undefined;
    setComposer({
      name: d?.name ?? selectedCandidate.name,
      address: d?.formattedAddress ?? selectedCandidate.formattedAddress,
      lat: selectedCandidate.latitude,
      lng: selectedCandidate.longitude,
      category: selectedCandidate.category,
      placeId: selectedCandidate.canonicalId ?? mine?.placeId,
      status: mine?.status ?? selectedCandidate.mySaveStatus,
      visibility: mine?.visibility,
      note: mine?.privateNotes ?? undefined,
      dogBadges: (mine?.dogBadges as ComposerDraft["dogBadges"]) ?? undefined,
    });
  }

  async function saveComposer(payload: ComposerSavePayload) {
    if (!signedIn) {
      router.push("/login?next=/explore");
      throw new Error("Sign in to save places.");
    }
    setBusy(true);
    try {
      if (selectedCandidate) {
        const res = await fetch("/api/discovery/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name,
            latitude: payload.lat,
            longitude: payload.lng,
            category: payload.category,
            status: payload.status,
            visibility: payload.visibility,
            note: payload.note,
            dogBadges: payload.dogBadges,
            formattedAddress: payload.address,
            locality: payload.city,
            website: details?.website,
            phone: details?.phone,
            provider: selectedCandidate.provider === "dogmarked" ? "custom" : selectedCandidate.provider,
            externalId: selectedCandidate.externalId,
            attribution: details?.attribution ?? selectedCandidate.attribution,
            details: details ?? undefined,
            photoRefs: photos,
            tips,
          }),
        });
        const json = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) throw new Error(json.error ?? "Could not save.");
        setComposer(null);
        setSelectedCandidate(null);
        setNearby(null);
        setToast(json.message ?? "Saved to your map.");
        await loadMySaves();
        return;
      }

      // Custom place path via existing APIs
      let placeId = payload.placeId;
      if (!placeId) {
        const createRes = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name,
            category: categoryToDb(payload.category),
            lat: payload.lat,
            lng: payload.lng,
            address: payload.address ?? null,
            city: payload.city ?? null,
            countryCode: "US",
          }),
        });
        const createJson = (await createRes.json()) as {
          place?: { id: string };
          error?: string;
        };
        if (!createRes.ok || !createJson.place) {
          throw new Error(createJson.error ?? "Could not create place.");
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
          category: categoryToDb(payload.category),
        }),
      });
      const saveJson = (await saveRes.json()) as { error?: string; message?: string };
      if (!saveRes.ok) throw new Error(saveJson.error ?? "Could not save.");
      setComposer(null);
      setNearby(null);
      setToast(saveJson.message ?? "Saved to your map.");
      await loadMySaves();
    } finally {
      setBusy(false);
    }
  }

  const listPins = useMemo(() => {
    let rows = mySaves;
    if (statusTab !== "all") rows = rows.filter((p) => p.status === statusTab);
    return rows;
  }, [mySaves, statusTab]);

  /** Merge my + community into one marker per canonical place when both on. */
  const mapPlaces = useMemo(() => {
    const byPlace = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        category: MySavePin["category"];
        lat: number;
        lng: number;
        countryCode: string;
        city: string | null;
        address: string | null;
        status: "active";
        policy: null;
        saveLayer: "mine" | "others" | "shared";
        saveStatus: MvpSaveStatus;
        contributorCount?: number;
        emoji: string;
        policyStatus: MarkerShellStatus;
      }
    >();

    if (showMine) {
      for (const p of mySaves) {
        const policyStatus = resolveMarkerPolicyStatus({
          dogBadges: p.dogBadges,
        });
        byPlace.set(p.placeId, {
          id: p.placeId,
          name: p.name,
          slug: p.slug,
          category: p.category,
          lat: p.lat,
          lng: p.lng,
          countryCode: "US",
          city: p.city,
          address: p.address,
          status: "active",
          policy: null,
          saveLayer: "mine",
          saveStatus: p.status,
          emoji: categoryEmoji(dbToCategory(p.category)),
          policyStatus,
        });
      }
    }

    if (showCommunity) {
      const counts = new Map<string, number>();
      for (const p of publicPins) {
        counts.set(p.placeId, (counts.get(p.placeId) ?? 0) + 1);
      }
      for (const p of publicPins) {
        const existing = byPlace.get(p.placeId);
        if (existing) {
          existing.saveLayer = "shared";
          existing.contributorCount = counts.get(p.placeId);
          if (existing.policyStatus === "unknown") {
            existing.policyStatus = resolveMarkerPolicyStatus({
              dogBadges: p.dogBadges,
              communityReported: true,
            });
          }
          continue;
        }
        if (showMine && mySaves.some((m) => m.placeId === p.placeId)) continue;
        byPlace.set(p.placeId, {
          id: p.placeId,
          name: p.name,
          slug: p.slug,
          category: p.category,
          lat: p.lat,
          lng: p.lng,
          countryCode: "US",
          city: p.city,
          address: p.address,
          status: "active",
          policy: null,
          saveLayer: "others",
          saveStatus: p.status,
          contributorCount: counts.get(p.placeId),
          emoji: categoryEmoji(dbToCategory(p.category)),
          policyStatus: resolveMarkerPolicyStatus({
            dogBadges: p.dogBadges,
            communityReported: true,
          }),
        });
      }
    }

    return [...byPlace.values()];
  }, [mySaves, publicPins, showMine, showCommunity]);

  const filteredNearbyCandidates = useMemo(() => {
    if (!nearby) return [];
    return nearby.candidates.filter((c) =>
      passesDogFriendlyFilter(c.policyStatus ?? "unknown", dogFriendlyFilter),
    );
  }, [nearby, dogFriendlyFilter]);

  const candidatePlaces = useMemo(() => {
    return filteredNearbyCandidates.map((n) => ({
      id: `cand-${n.externalId}`,
      name: n.name,
      slug: n.slug ?? `candidate-${n.externalId}`,
      category: n.category as never,
      lat: n.latitude,
      lng: n.longitude,
      countryCode: n.countryCode ?? "US",
      city: n.locality ?? null,
      address: n.formattedAddress ?? null,
      status: "active" as const,
      policy: null,
      saveLayer: "candidate" as const,
      saveStatus: "want_to_go" as const,
      emoji: categoryEmoji(n.category),
      contributorCount: n.publicContributorCount,
      policyStatus: (n.policyStatus ?? "unknown") as MarkerShellStatus,
    }));
  }, [filteredNearbyCandidates]);

  const allMapPlaces = useMemo(
    () => [...mapPlaces, ...(showDiscover ? candidatePlaces : [])],
    [mapPlaces, candidatePlaces, showDiscover],
  );

  const layersOff = !showMine && !showCommunity && !showDiscover;
  const sheetOpen = Boolean(
    nearby || composer || previewMine || selectedCandidate,
  );
  const cameraPadding = useMemo(
    () =>
      exploreMapPadding({
        drawerOpen: sheetOpen,
        isDesktop,
        drawerWidth: 460,
        headerHeight: 64,
      }),
    [sheetOpen, isDesktop],
  );

  const selectedMySave = useMemo(() => {
    if (!selectedCandidate?.canonicalId) return null;
    return (
      mySaves.find((s) => s.placeId === selectedCandidate.canonicalId) ?? null
    );
  }, [selectedCandidate, mySaves]);

  const drawerContent = composer ? (
    <PlaceComposer
      draft={composer}
      busy={busy}
      onClose={() => setComposer(null)}
      onSave={saveComposer}
    />
  ) : selectedCandidate ? (
    <PlacePreviewCard
      candidate={selectedCandidate}
      details={details}
      detailsLoading={detailsLoading}
      photos={photos}
      photosLoading={photosLoading}
      tips={tips}
      tipsLoading={tipsLoading}
      tipsEnabled={tipsEnabled}
      placeId={selectedCandidate.canonicalId}
      placeLinks={placeLinks}
      dogs={activeDogs}
      pets={pets}
      myEntry={
        selectedMySave
          ? {
              status: selectedMySave.status,
              visibility: selectedMySave.visibility,
              note: selectedMySave.privateNotes,
              dogBadges: selectedMySave.dogBadges,
            }
          : selectedCandidate.alreadySavedByMe
            ? { status: selectedCandidate.mySaveStatus ?? "want_to_go" }
            : null
      }
      communityNotes={[]}
      busy={busy}
      onBack={() => {
        setSelectedCandidate(null);
        setDetails(null);
        setPhotos([]);
        setTips([]);
        setTipsEnabled(false);
        setPlaceLinks([]);
      }}
      onClose={() => {
        setSelectedCandidate(null);
        setNearby(null);
        setPlaceLinks([]);
      }}
      onSave={openComposerFromCandidate}
      onEditEntry={openComposerFromCandidate}
    />
  ) : nearby ? (
    <NearbyPanel
      session={nearby}
      candidates={filteredNearbyCandidates}
      loading={nearbyLoading}
      dogFriendlyFilter={dogFriendlyFilter}
      onDogFriendlyFilterChange={setDogFriendlyFilter}
      onSelect={(c) => void enrichCandidate(c)}
      onCustom={startCustomComposer}
      onRadius={(r) => void runNearby(nearby.lat, nearby.lng, r, nearby.label)}
      onClose={() => {
        setNearby(null);
        setChooseLocation(false);
      }}
      onSearchArea={() =>
        void runNearby(nearby.lat, nearby.lng, nearby.radiusMeters, nearby.label)
      }
    />
  ) : previewMine ? (
    <MinePreview
      pin={previewMine}
      onClose={() => setPreviewMine(null)}
      onEdit={() => {
        setComposer({
          name: previewMine.name,
          address: previewMine.address ?? undefined,
          lat: previewMine.lat,
          lng: previewMine.lng,
          category: dbToCategory(previewMine.category),
          placeId: previewMine.placeId,
          status: previewMine.status,
          visibility: previewMine.visibility,
          note: previewMine.privateNotes ?? undefined,
          dogBadges: previewMine.dogBadges as never,
        });
        setPreviewMine(null);
      }}
    />
  ) : null;

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem-3rem)] flex-col sm:h-[calc(100dvh-4rem)]">
      {toast ? (
        <div className="absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-[var(--color-brand-600)] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
          <button type="button" className="ml-2" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-3 top-3 z-20 flex gap-2">
        <div className="pointer-events-auto flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 shadow">
          <button
            type="button"
            onClick={() => setView("map")}
            className={cn(
              "inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold",
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
              "inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold",
              view === "list"
                ? "bg-[var(--color-brand-600)] text-white"
                : "text-[var(--color-text-muted)]",
            )}
          >
            <List className="h-4 w-4" /> List
          </button>
        </div>
      </div>

      {chooseLocation ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 shadow-lg">
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              Tap the map to drop a pin
            </p>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[var(--color-accent-600)]"
              onClick={() => setChooseLocation(false)}
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setComposer(null);
          setPreviewMine(null);
          setSelectedCandidate(null);
          setNearby(null);
          setChooseLocation(true);
        }}
        className="pointer-events-auto absolute bottom-6 right-4 z-20 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-accent-500)] px-5 text-sm font-semibold text-white shadow-lg transition-transform duration-150 hover:scale-[1.02] xl:bottom-8"
      >
        <Plus className="h-5 w-5" /> Add a place
      </button>

      {/* Keep MapLibre mounted across Map/List toggles — never remount into a blank canvas. */}
      <div
        className={cn(
          "relative min-h-0 flex-1",
          view !== "map" && "pointer-events-none invisible absolute inset-0",
        )}
        aria-hidden={view !== "map"}
      >
        <MapView
          places={allMapPlaces as never}
          selectedSlug={previewMine?.slug ?? null}
          selectedCandidateId={
            selectedCandidate ? `cand-${selectedCandidate.externalId}` : null
          }
          flyTo={flyTo}
          suppressAutoFocus={Boolean(nearby) && !selectedCandidate}
          tempPin={
            nearby
              ? {
                  lat: nearby.lat,
                  lng: nearby.lng,
                  radiusMeters: nearby.radiusMeters,
                }
              : null
          }
          chooseLocationMode={chooseLocation}
          paddingRight={isDesktop && sheetOpen ? 460 : 0}
          mapPadding={cameraPadding}
          onMapClick={onMapClick}
          onTempPinChange={(pin) => {
            if (!nearby) return;
            setNearby({ ...nearby, lat: pin.lat, lng: pin.lng });
          }}
          onTempPinDragEnd={(pin) => {
            void runNearby(
              pin.lat,
              pin.lng,
              nearby?.radiusMeters ?? DEFAULT_RADIUS_M,
              nearby?.label,
            );
          }}
          onBoundsChange={onBoundsChange}
          onMapApi={(api) => {
            mapApiRef.current = api;
          }}
          className="h-full w-full"
        />

        {layersOff ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
            <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-center text-sm text-[var(--color-text-muted)] shadow">
              Open Layers to show My places, Community, or nearby discovery.
            </p>
          </div>
        ) : null}

        {view === "map" && searchHits.length > 0 ? (
          <div
            className="absolute left-3 top-16 z-20 max-h-64 w-[min(100%-1.5rem,22rem)] overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
            role="listbox"
            aria-label="Search suggestions"
          >
            {searchHits.map((hit) => (
              <button
                key={`${hit.provider}-${hit.externalId}`}
                type="button"
                role="option"
                className="block w-full border-b border-[var(--color-border)] px-4 py-3 text-left last:border-0 hover:bg-[var(--color-surface-muted)]"
                onClick={() => {
                  suppressAutocompleteRef.current = true;
                  setSearchHits([]);
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("q", hit.name);
                  router.replace(`/explore?${params.toString()}`);
                  if (isLocalityLike(hit) || hit.resultKind === "address") {
                    void runNearby(
                      hit.lat,
                      hit.lng,
                      DEFAULT_RADIUS_M,
                      hit.name,
                      { resultKind: hit.resultKind },
                    );
                  } else {
                    const candidate: PlaceCandidate = {
                      provider: "maptiler",
                      externalId: hit.externalId,
                      name: hit.name,
                      latitude: hit.lat,
                      longitude: hit.lng,
                      category: dbToCategory(hit.category),
                      formattedAddress: hit.formattedAddress,
                      countryCode: hit.countryCode,
                      attribution: hit.attribution,
                    };
                    setNearby({
                      lat: hit.lat,
                      lng: hit.lng,
                      label: hit.name,
                      radiusMeters: DEFAULT_RADIUS_M,
                      candidates: [candidate],
                      discoveryAvailable: true,
                      status: "success",
                    });
                    setFlyTo({
                      lat: hit.lat,
                      lng: hit.lng,
                      zoom: placeFocusZoom(),
                    });
                    void enrichCandidate(candidate);
                  }
                }}
              >
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  {hit.name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {hit.resultKind}
                  {hit.formattedAddress ? ` · ${hit.formattedAddress}` : ""}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        {view === "map" && isDesktop && sheetOpen ? (
          <aside className="absolute bottom-0 right-0 top-0 z-30 w-[min(100%,460px)] border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
            {drawerContent}
          </aside>
        ) : null}
      </div>

      {view === "list" ? (
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
            {listPins.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 text-center">
                <p className="font-display text-xl text-[var(--color-ink)]">
                  Your map is empty
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Drop a pin, pick a nearby place, and save your first pin.
                </p>
                <Button
                  className="mt-4 min-h-11 rounded-full bg-[var(--color-accent-500)] text-white"
                  onClick={() => {
                    setView("map");
                    setChooseLocation(true);
                  }}
                >
                  Add a place
                </Button>
              </div>
            ) : (
              listPins.map((pin) => (
                <button
                  key={pin.placeId}
                  type="button"
                  className="flex w-full gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3 text-left"
                  onClick={() => {
                    setView("map");
                    setFlyTo({ lat: pin.lat, lng: pin.lng, zoom: 16 });
                    setPreviewMine(pin);
                    setNearby(null);
                  }}
                >
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-2xl"
                    aria-hidden
                  >
                    {categoryEmoji(dbToCategory(pin.category))}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--color-ink)]">
                      {pin.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {categoryLabel(dbToCategory(pin.category))} ·{" "}
                      {pin.status === "been_there" ? "Been there" : "Want to go"}
                    </p>
                    {pin.address || pin.city ? (
                      <p className="truncate text-xs text-[var(--color-text-muted)]">
                        {pin.address ?? pin.city}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {!isDesktop ? (
        <Sheet
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) {
              setNearby(null);
              setComposer(null);
              setPreviewMine(null);
              setSelectedCandidate(null);
              setChooseLocation(false);
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
    </div>
  );
}

function NearbyPanel({
  session,
  candidates,
  loading,
  dogFriendlyFilter,
  onDogFriendlyFilterChange,
  onSelect,
  onCustom,
  onRadius,
  onClose,
  onSearchArea,
}: {
  session: NearbySession;
  candidates: PlaceCandidate[];
  loading: boolean;
  dogFriendlyFilter: DogFriendlyFilterMode;
  onDogFriendlyFilterChange: (mode: DogFriendlyFilterMode) => void;
  onSelect: (c: PlaceCandidate) => void;
  onCustom: () => void;
  onRadius: (r: number) => void;
  onClose: () => void;
  onSearchArea: () => void;
}) {
  const hiddenByFilter =
    session.candidates.length - candidates.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Nearby places
          </p>
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            Explore around {session.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 text-sm text-[var(--color-text-muted)]"
        >
          Close
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 px-4">
        {RADIUS_PRESETS_M.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRadius(r)}
            className={cn(
              "min-h-10 rounded-full px-3 text-xs font-semibold",
              session.radiusMeters === r
                ? "bg-[var(--color-brand-600)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
            )}
          >
            {r < 1000 ? `${r} m` : `${r / 1000} km`}
          </button>
        ))}
        <button
          type="button"
          onClick={onSearchArea}
          className="min-h-10 rounded-full border border-[var(--color-border)] px-3 text-xs font-semibold"
        >
          Search this area
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 px-4">
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-medium text-[var(--color-ink-muted)]">
          <input
            type="checkbox"
            checked={dogFriendlyFilter === "known_only"}
            onChange={(e) =>
              onDogFriendlyFilterChange(
                e.target.checked ? "known_only" : "include_unknown",
              )
            }
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          Known dog-friendly only
        </label>
        {hiddenByFilter > 0 ? (
          <span className="text-xs text-[var(--color-ink-muted)]">
            {hiddenByFilter} hidden
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
        {loading || session.status === "loading" ? (
          <div className="space-y-2 px-2">
            <p className="px-2 pb-2 text-sm text-[var(--color-text-muted)]">
              {session.message ?? `Finding places around ${session.label}…`}
            </p>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-[var(--color-surface-muted)]"
              />
            ))}
          </div>
        ) : session.candidates.length === 0 ? (
          <div className="space-y-2 px-4 py-6 text-sm text-[var(--color-text-muted)]">
            <p>
              {session.message ??
                `No listed places were found within ${session.radiusMeters} m. Try a larger radius or create a custom place.`}
            </p>
            {session.errorCode &&
            (session.status === "failure" ||
              session.status === "config" ||
              session.status === "auth") ? (
              <p className="font-mono text-xs text-[var(--color-text-muted)]">
                Code: {session.errorCode}
              </p>
            ) : null}
          </div>
        ) : candidates.length === 0 ? (
          <div className="space-y-2 px-4 py-6 text-sm text-[var(--color-text-muted)]">
            <p>
              No places with Dogmarked dog-policy evidence in this area.
              Switch to “Include unknown places” to see more.
            </p>
            {hiddenByFilter > 0 ? (
              <p className="text-xs">
                {hiddenByFilter} place{hiddenByFilter === 1 ? "" : "s"} hidden by
                this filter.
              </p>
            ) : null}
          </div>
        ) : (
          candidates.map((place) => (
            <button
              key={`${place.provider}-${place.externalId}`}
              type="button"
              onClick={() => onSelect(place)}
              className="flex w-full gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--color-surface-muted)]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-surface-muted)] text-xl">
                {place.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={place.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  categoryEmoji(place.category)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--color-ink)]">{place.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {categoryLabel(place.category as MvpCategoryId)}
                  {place.distanceMeters != null
                    ? ` · ${formatDistance(place.distanceMeters)}`
                    : ""}
                  {place.publicContributorCount
                    ? ` · ${place.publicContributorCount} public`
                    : ""}
                  {place.alreadySavedByMe ? " · Saved" : ""}
                </p>
                {place.formattedAddress || place.locality ? (
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    {place.formattedAddress ?? place.locality}
                  </p>
                ) : null}
              </div>
            </button>
          ))
        )}

        <button
          type="button"
          onClick={onCustom}
          className="mx-2 mt-2 flex min-h-12 w-[calc(100%-1rem)] items-center justify-center rounded-full border border-dashed border-[var(--color-border)] text-sm font-semibold text-[var(--color-brand-600)]"
        >
          Create a custom place at this pin
        </button>
      </div>
    </div>
  );
}

const legacyEnrichTried = new Set<string>();

function MinePreview({
  pin,
  onClose,
  onEdit,
}: {
  pin: MySavePin;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [community, setCommunity] = useState<
    Array<{ handle: string; displayName: string; note: string | null }>
  >([]);
  const [contributorCount, setContributorCount] = useState(0);

  useEffect(() => {
    void fetch(`/api/places/${encodeURIComponent(pin.slug)}/community`)
      .then((r) => r.json())
      .then(
        (j: {
          notes?: Array<{ handle: string; displayName: string; note: string | null }>;
          contributorCount?: number;
        }) => {
          setCommunity(j.notes ?? []);
          setContributorCount(j.contributorCount ?? 0);
        },
      )
      .catch(() => {
        setCommunity([]);
      });

    // Legacy enrichment: resolve once per place when sparse (non-blocking)
    const key = pin.placeId;
    if (!legacyEnrichTried.has(key)) {
      legacyEnrichTried.add(key);
      void fetch("/api/discovery/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pin.name,
          latitude: pin.lat,
          longitude: pin.lng,
          address: pin.address ?? pin.city ?? undefined,
        }),
      })
        .then((r) => r.json())
        .then(async (j: { candidate?: PlaceCandidate | null }) => {
          if (!j.candidate?.externalId || j.candidate.provider !== "foursquare") return;
          await fetch("/api/discovery/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: pin.name,
              latitude: pin.lat,
              longitude: pin.lng,
              category: dbToCategory(pin.category),
              status: pin.status,
              visibility: pin.visibility,
              note: pin.privateNotes,
              dogBadges: pin.dogBadges,
              formattedAddress: pin.address,
              locality: pin.city,
              provider: "foursquare",
              externalId: j.candidate.externalId,
              attribution: j.candidate.attribution,
            }),
          }).catch(() => {
            /* non-blocking */
          });
        })
        .catch(() => {
          /* non-blocking */
        });
    }
  }, [pin]);

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            {categoryEmoji(dbToCategory(pin.category))}{" "}
            {categoryLabel(dbToCategory(pin.category))}
          </p>
          <h2 className="font-display text-2xl text-[var(--color-ink)]">{pin.name}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {pin.status === "been_there" ? "Been there" : "Want to go"} ·{" "}
            {pin.visibility === "public" ? "Visible to others" : "Private"}
            {contributorCount > 0 ? ` · ${contributorCount} public` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="min-h-10 text-sm text-[var(--color-text-muted)]">
          Close
        </button>
      </div>
      <section className="mt-4">
        <h3 className="text-sm font-semibold">My note</h3>
        {pin.privateNotes ? (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{pin.privateNotes}</p>
        ) : (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">No personal note yet.</p>
        )}
      </section>
      {pin.dogBadges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {pin.dogBadges.map((b) => (
            <span
              key={b}
              className="rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-xs"
            >
              {b.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Dog access not documented yet.
        </p>
      )}
      <section className="mt-4">
        <h3 className="text-sm font-semibold">Community notes</h3>
        {community.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">No public notes yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {community.map((n, i) => (
              <li key={`${n.handle}-${i}`} className="text-sm">
                <span className="font-semibold">{n.displayName || n.handle}</span>
                {n.note ? (
                  <p className="text-[var(--color-text-muted)]">{n.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Button
        className="mt-auto min-h-12 rounded-full bg-[var(--color-brand-600)] text-white"
        onClick={onEdit}
      >
        Edit
      </Button>
    </div>
  );
}
