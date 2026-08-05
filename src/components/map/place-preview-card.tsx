"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, Navigation, Phone, Share2 } from "lucide-react";
import { PlaceHero } from "@/components/place/place-hero";
import { PlaceLinksCta } from "@/components/place/place-links-cta";
import { PlaceMyEntry, type PlaceMyEntryData } from "@/components/place/place-my-entry";
import { PlacePackCompat } from "@/components/place/place-pack-compat";
import { PlacePolicyChips } from "@/components/place/place-policy-chips";
import { PlaceStickyActions } from "@/components/place/place-sticky-actions";
import { PlaceVerdict } from "@/components/place/place-verdict";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TripReportPanel,
  type PetOption,
  type TripReportMode,
} from "@/components/trip-report";
import type {
  PlaceCandidate,
  PlaceDetails,
  PlacePhoto,
  PlaceTip,
} from "@/lib/discovery/types";
import { categoryLabel, type MvpCategoryId } from "@/lib/mvp/taxonomy";
import type { PlaceLink } from "@/lib/place-links";
import type { PetPolicyReport, PlacePolicySummary } from "@/lib/policy/evidence";
import { dogPolicyFromSummary } from "@/lib/policy/summary-ui";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { DogProfile, PetProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CommunityNote = {
  handle: string;
  displayName: string;
  status: string;
  note: string | null;
  dogBadges: string[];
  updatedAt?: string;
};

type Props = {
  candidate: PlaceCandidate;
  details: PlaceDetails | null;
  detailsLoading: boolean;
  photos: PlacePhoto[];
  photosLoading: boolean;
  tips: PlaceTip[];
  tipsLoading: boolean;
  /** Tips are off by default — only show when enabled and non-empty. */
  tipsEnabled?: boolean;
  /** Canonical Dogmarked place id when known. */
  placeId?: string | null;
  dogs?: DogProfile[];
  pets?: PetProfile[];
  myEntry?: PlaceMyEntryData | null;
  communityNotes?: CommunityNote[];
  /** Verified official / Booking links (Phase 11). */
  placeLinks?: PlaceLink[] | null;
  /** Concurrent trip-report UI slot — replaces default TripReportPanel when set. */
  tripReportsSlot?: React.ReactNode;
  /** Concurrent place-links slot — replaces PlaceLinksCta when set. */
  placeLinksSlot?: React.ReactNode;
  bookingHref?: string | null;
  onBack: () => void;
  onSave: () => void;
  onClose: () => void;
  onEditEntry?: () => void;
  onAddTripReport?: () => void;
  busy?: boolean;
};

function formatDistance(m?: number) {
  if (m == null || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

async function sharePlace(name: string, url: string) {
  try {
    if (navigator.share) {
      await navigator.share({ title: name, text: name, url });
      return;
    }
  } catch {
    /* cancelled */
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* ignore */
  }
}

function petsToOptions(pets: PetProfile[] | undefined): PetOption[] {
  if (!pets?.length) return [];
  return pets
    .filter((p) => p.isActive)
    .map((p) => ({ id: p.id, name: p.name }));
}

export function PlacePreviewCard({
  candidate,
  details,
  detailsLoading,
  photos,
  photosLoading,
  tips,
  tipsLoading,
  tipsEnabled = false,
  placeId: placeIdProp,
  dogs: dogsProp,
  pets,
  myEntry,
  communityNotes = [],
  placeLinks,
  tripReportsSlot,
  placeLinksSlot,
  bookingHref: bookingHrefProp,
  onBack,
  onSave,
  onClose,
  onEditEntry,
  onAddTripReport,
  busy,
}: Props) {
  const placeId = placeIdProp ?? candidate.canonicalId ?? null;
  const dogs = dogsProp?.length ? dogsProp : DEFAULT_DOG_PROFILES;
  const category = (details?.category ?? candidate.category) as MvpCategoryId;
  const name = details?.name ?? candidate.name;
  const address =
    details?.formattedAddress ?? candidate.formattedAddress ?? candidate.locality;
  const phone = details?.phone ?? candidate.phone;
  const website = details?.website ?? candidate.website;
  const hours = details?.hoursSummary;
  const openNow = details?.openNow;
  const distance = formatDistance(candidate.distanceMeters);
  const attribution = details?.attribution ?? candidate.attribution;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${candidate.latitude},${candidate.longitude}`;
  const saved = Boolean(candidate.alreadySavedByMe || myEntry?.status);
  const shareUrl =
    typeof window !== "undefined" && candidate.slug
      ? `${window.location.origin}/place/${candidate.slug}`
      : typeof window !== "undefined"
        ? window.location.href
        : "";

  const bookingFromLinks = placeLinks?.find((l) => l.provider === "booking")?.url;
  const bookingHref = bookingHrefProp ?? bookingFromLinks ?? null;

  const [summary, setSummary] = useState<PlacePolicySummary | null>(null);
  const [reports, setReports] = useState<PetPolicyReport[]>([]);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyTick, setPolicyTick] = useState(0);
  const [tripMode, setTripMode] = useState<TripReportMode | null>(null);

  const reloadPolicy = useCallback(() => {
    setPolicyTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!placeId) {
      setSummary(null);
      setReports([]);
      setPolicyLoading(false);
      return;
    }

    const ac = new AbortController();
    setPolicyLoading(true);
    void fetch(`/api/pet-policy-reports?placeId=${encodeURIComponent(placeId)}`, {
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then(
        (j: {
          summary?: PlacePolicySummary;
          reports?: PetPolicyReport[];
        }) => {
          if (ac.signal.aborted) return;
          setSummary(j.summary ?? null);
          setReports(j.reports ?? []);
        },
      )
      .catch(() => {
        if (!ac.signal.aborted) {
          setSummary(null);
          setReports([]);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setPolicyLoading(false);
      });

    return () => ac.abort();
  }, [placeId, policyTick]);

  const sampleReport = useMemo(() => {
    return (
      reports.find((r) => r.visibility === "public" && r.overallStatus !== "unknown") ??
      reports.find((r) => r.visibility === "public") ??
      null
    );
  }, [reports]);

  const policy = useMemo(() => {
    if (!placeId || !summary) return null;
    return dogPolicyFromSummary(placeId, summary, sampleReport);
  }, [placeId, summary, sampleReport]);

  const showTips = tipsEnabled && !tipsLoading && tips.length > 0;

  function handleAddTripReport() {
    onAddTripReport?.();
    if (placeId) setTripMode("trip_report");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-10 text-sm font-semibold text-[var(--color-brand)]"
        >
          ← Nearby places
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 text-sm text-[var(--color-ink-muted)]"
        >
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PlaceHero
          photos={photos}
          photosLoading={photosLoading}
          category={category}
          attribution={attribution}
        />

        <div className="space-y-5 px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
              {categoryLabel(category)}
              {distance ? ` · ${distance}` : ""}
            </p>
            <h2 className="font-display text-2xl text-[var(--color-ink)]">
              {name}
            </h2>
            {address ? (
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{address}</p>
            ) : null}

            {detailsLoading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-[var(--color-ink-muted)]">
                {hours ? (
                  <p>
                    {openNow === true
                      ? "Open now · "
                      : openNow === false
                        ? "Closed · "
                        : ""}
                    {hours}
                  </p>
                ) : null}
                {details?.description ? <p>{details.description}</p> : null}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <IconButton
                variant="outline"
                size="sm"
                aria-label="Directions"
                onClick={() => window.open(directionsUrl, "_blank", "noreferrer")}
              >
                <Navigation className="h-4 w-4" />
              </IconButton>
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                  aria-label="Website"
                >
                  <Globe className="h-4 w-4" />
                </a>
              ) : null}
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                  aria-label="Call"
                >
                  <Phone className="h-4 w-4" />
                </a>
              ) : null}
              <IconButton
                variant="outline"
                size="sm"
                aria-label="Share"
                onClick={() => void sharePlace(name, shareUrl || directionsUrl)}
              >
                <Share2 className="h-4 w-4" />
              </IconButton>
              {saved ? (
                <span
                  className={cn(
                    "ml-1 rounded-lg px-2 py-1 text-xs font-semibold",
                    "bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]",
                  )}
                >
                  Saved
                </span>
              ) : null}
            </div>
          </div>

          <PlaceVerdict summary={summary} loading={Boolean(placeId) && policyLoading} />

          <PlacePackCompat dogs={dogs} pets={pets} policy={policy} />

          <PlacePolicyChips
            summary={summary}
            sampleReport={sampleReport}
            loading={Boolean(placeId) && policyLoading}
          />

          <PlaceMyEntry
            entry={myEntry}
            saved={saved}
            onEdit={onEditEntry ?? onSave}
          />

          <section aria-label="Trip reports">
            {tripReportsSlot ?? (
              <TripReportPanel
                placeId={placeId}
                placeName={name}
                pets={petsToOptions(pets)}
                mode={tripMode}
                onModeChange={setTripMode}
                showFeed
                onReportSaved={() => reloadPolicy()}
              />
            )}
          </section>

          {placeLinksSlot ?? (
            <PlaceLinksCta
              links={placeLinks}
              fallbackOfficialUrl={website}
              placeName={name}
            />
          )}

          {tipsLoading && tipsEnabled ? (
            <Skeleton className="h-16 w-full" />
          ) : showTips ? (
            <section>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                Visitor tips
              </h3>
              <ul className="mt-2 space-y-2">
                {tips.map((t) => (
                  <li
                    key={t.id}
                    className="border-t border-[var(--color-border)] pt-2 text-sm text-[var(--color-ink)] first:border-0 first:pt-0"
                  >
                    {t.text}
                    {t.attribution ? (
                      <span className="mt-1 block text-xs text-[var(--color-ink-muted)]">
                        {t.attribution}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {communityNotes.length > 0 ? (
            <section>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                Community notes
              </h3>
              <ul className="mt-2 space-y-2">
                {communityNotes.map((n, i) => (
                  <li key={`${n.handle}-${i}`} className="text-sm">
                    <span className="font-semibold">{n.displayName || n.handle}</span>
                    {n.note ? (
                      <p className="text-[var(--color-ink-muted)]">{n.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {attribution ? (
            <p className="text-xs text-[var(--color-ink-muted)]">{attribution}</p>
          ) : null}
        </div>
      </div>

      <PlaceStickyActions
        saved={saved}
        busy={busy}
        directionsUrl={directionsUrl}
        website={website}
        bookingHref={bookingHref}
        onSave={onSave}
        onAddTripReport={handleAddTripReport}
        canAddTripReport={Boolean(placeId)}
      />
    </div>
  );
}
