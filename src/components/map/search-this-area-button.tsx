"use client";

import { useState } from "react";

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SearchThisAreaButtonProps {
  /** Current map bounds; when null the button stays disabled. */
  bounds: MapBounds | null;
  onSearch: (bounds: MapBounds) => void | Promise<void>;
  /** When true, show a subtle “results may be stale” cue (e.g. after pan). */
  dirty?: boolean;
  className?: string;
  label?: string;
  loadingLabel?: string;
}

/**
 * Map chrome control: re-query places for the visible viewport.
 * Wire from Explore client after MapLibre `moveend` updates bounds.
 */
export function SearchThisAreaButton({
  bounds,
  onSearch,
  dirty = true,
  className,
  label = "Search this area",
  loadingLabel = "Searching…",
}: SearchThisAreaButtonProps) {
  const [pending, setPending] = useState(false);

  if (!dirty && !pending) {
    return null;
  }

  const disabled = !bounds || pending;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={pending}
      className={[
        "pointer-events-auto inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium shadow-md transition",
        "bg-[var(--paper,#f7f4ef)] text-[var(--ink,#1c2421)] ring-1 ring-[var(--ink,#1c2421)]/10",
        "hover:bg-white disabled:cursor-not-allowed disabled:opacity-50",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={async () => {
        if (!bounds) return;
        setPending(true);
        try {
          await onSearch(bounds);
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? loadingLabel : label}
    </button>
  );
}
