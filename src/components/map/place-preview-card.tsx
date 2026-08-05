"use client";

import { ExternalLink, Globe, MapPin, Navigation, Phone } from "lucide-react";
import { categoryArtworkClass, categoryEmoji } from "@/lib/discovery/category-icons";
import type {
  PlaceCandidate,
  PlaceDetails,
  PlacePhoto,
  PlaceTip,
} from "@/lib/discovery/types";
import { categoryLabel, type MvpCategoryId } from "@/lib/mvp/taxonomy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  myNote?: string | null;
  myStatus?: string | null;
  myBadges?: string[];
  communityNotes?: CommunityNote[];
  onBack: () => void;
  onSave: () => void;
  onClose: () => void;
  busy?: boolean;
};

function formatDistance(m?: number) {
  if (m == null || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function PlacePreviewCard({
  candidate,
  details,
  detailsLoading,
  photos,
  photosLoading,
  tips,
  tipsLoading,
  myNote,
  myStatus,
  myBadges,
  communityNotes = [],
  onBack,
  onSave,
  onClose,
  busy,
}: Props) {
  const category = (details?.category ?? candidate.category) as MvpCategoryId;
  const name = details?.name ?? candidate.name;
  const address =
    details?.formattedAddress ?? candidate.formattedAddress ?? candidate.locality;
  const phone = details?.phone;
  const website = details?.website;
  const hours = details?.hoursSummary;
  const openNow = details?.openNow;
  const distance = formatDistance(candidate.distanceMeters);
  const attribution = details?.attribution ?? candidate.attribution;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${candidate.latitude},${candidate.longitude}`;

  const hero = photos[0]?.url;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-10 text-sm font-semibold text-[var(--color-brand-600)]"
        >
          ← Nearby places
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 text-sm text-[var(--color-text-muted)]"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {photosLoading ? (
          <div className="h-44 animate-pulse bg-[var(--color-surface-muted)]" />
        ) : hero ? (
          <div className="relative h-44 w-full overflow-hidden bg-[var(--color-surface-muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero}
              alt=""
              className="h-full w-full object-cover transition-opacity duration-300"
            />
            {photos.length > 1 ? (
              <div className="absolute bottom-2 left-2 flex gap-1">
                {photos.slice(0, 5).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={p.url}
                    alt=""
                    className="h-10 w-10 rounded-md border border-white/80 object-cover"
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              "flex h-28 items-center justify-center text-4xl",
              categoryArtworkClass(category),
            )}
            aria-hidden
          >
            {categoryEmoji(category)}
          </div>
        )}

        <div className="space-y-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {categoryEmoji(category)} {categoryLabel(category)}
              {distance ? ` · ${distance}` : ""}
            </p>
            <h2 className="font-display text-2xl text-[var(--color-ink)]">{name}</h2>
            {address ? (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-[var(--color-text-muted)]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                {address}
              </p>
            ) : null}
          </div>

          {detailsLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--color-surface-muted)]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-surface-muted)]" />
            </div>
          ) : (
            <div className="space-y-1 text-sm text-[var(--color-text)]">
              {hours ? (
                <p>
                  {openNow === true ? "Open now · " : openNow === false ? "Closed · " : ""}
                  {hours}
                </p>
              ) : null}
              {details?.description ? (
                <p className="text-[var(--color-text-muted)]">{details.description}</p>
              ) : (
                <p className="text-[var(--color-text-muted)]">
                  {categoryLabel(category)}
                  {candidate.locality ? ` in ${candidate.locality}` : ""}.
                </p>
              )}
              <p className="text-sm text-[var(--color-text-muted)]">
                Dog access not documented yet.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 text-sm font-semibold"
            >
              <Navigation className="h-4 w-4" /> Directions
            </a>
            {website ? (
              <a
                href={website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 text-sm font-semibold"
              >
                <Globe className="h-4 w-4" /> Website
              </a>
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 text-sm font-semibold"
              >
                <Phone className="h-4 w-4" /> Call
              </a>
            ) : null}
          </div>

          {tipsLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-[var(--color-surface-muted)]" />
          ) : tips.length > 0 ? (
            <section>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Visitor tips</h3>
              <ul className="mt-2 space-y-2">
                {tips.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    {t.text}
                    {t.attribution ? (
                      <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                        {t.attribution}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(myNote || myStatus || (myBadges && myBadges.length > 0)) && (
            <section>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">My note</h3>
              {myStatus ? (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{myStatus}</p>
              ) : null}
              {myNote ? <p className="mt-1 text-sm">{myNote}</p> : null}
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">Community notes</h3>
            {communityNotes.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                No public notes yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {communityNotes.map((n, i) => (
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

          {attribution ? (
            <p className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <ExternalLink className="h-3 w-3" />
              {attribution}
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] p-4">
        <Button
          type="button"
          className="min-h-12 w-full rounded-full bg-[var(--color-brand-600)] text-white"
          disabled={busy}
          onClick={onSave}
        >
          Save to my map
        </Button>
      </div>
    </div>
  );
}
