"use client";

import { useState } from "react";
import { CategoryEmojiTile } from "@/components/ui/category-emoji-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryArtworkClass } from "@/lib/discovery/category-icons";
import type { PlacePhoto } from "@/lib/discovery/types";
import { categoryLabel, type MvpCategoryId } from "@/lib/mvp/taxonomy";
import { cn } from "@/lib/utils";

type Props = {
  photos: PlacePhoto[];
  photosLoading?: boolean;
  category: MvpCategoryId;
  attribution?: string | null;
};

/**
 * ~16:9 travel-guide hero — photo carousel or category artwork.
 * Never shows "Photo coming soon".
 */
export function PlaceHero({
  photos,
  photosLoading,
  category,
  attribution,
}: Props) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const usable = photos.filter((p) => p.url && !failed.has(p.id));
  const active = usable[Math.min(index, Math.max(0, usable.length - 1))];

  if (photosLoading) {
    return <Skeleton className="aspect-[16/9] w-full rounded-none" />;
  }

  if (!active) {
    return (
      <div
        className={cn(
          "relative flex aspect-[16/9] w-full flex-col items-center justify-center gap-2",
          categoryArtworkClass(category),
        )}
      >
        <CategoryEmojiTile category={category} size="lg" className="h-16 w-16 text-3xl" />
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
          {categoryLabel(category)}
        </p>
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--color-surface-muted)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={active.id}
        src={active.url}
        alt=""
        className="h-full w-full object-cover motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
        onError={() => {
          setFailed((prev) => new Set(prev).add(active.id));
          setIndex(0);
        }}
      />

      {usable.length > 1 ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/45 to-transparent px-3 pb-2.5 pt-8">
          <div className="flex gap-1.5" role="tablist" aria-label="Photos">
            {usable.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Photo ${i + 1}`}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === index ? "bg-white" : "bg-white/45",
                )}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded-md bg-black/35 px-2 py-1 text-xs font-semibold text-white"
              aria-label="Previous photo"
              onClick={() =>
                setIndex((i) => (i - 1 + usable.length) % usable.length)
              }
            >
              ‹
            </button>
            <button
              type="button"
              className="rounded-md bg-black/35 px-2 py-1 text-xs font-semibold text-white"
              aria-label="Next photo"
              onClick={() => setIndex((i) => (i + 1) % usable.length)}
            >
              ›
            </button>
          </div>
        </div>
      ) : null}

      {attribution || active.attribution ? (
        <p className="absolute left-2 top-2 max-w-[70%] truncate rounded-md bg-black/35 px-2 py-0.5 text-[10px] text-white/90">
          {active.attribution ?? attribution}
        </p>
      ) : null}
    </div>
  );
}
