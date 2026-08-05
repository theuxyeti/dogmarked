"use client";

import { useEffect, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

type Props = {
  showMine: boolean;
  showCommunity: boolean;
  showDiscover?: boolean;
  onChange: (next: {
    mine?: boolean;
    community?: boolean;
    discover?: boolean;
  }) => void;
  className?: string;
};

/** Compact Layers popover — independent My places / Community / Nearby toggles. */
export function LayersControl({
  showMine,
  showCommunity,
  showDiscover = true,
  onChange,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <IconButton
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Map layers"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-[var(--elevation-1)]",
          open && "ring-2 ring-[var(--focus-ring)]",
        )}
      >
        <Layers className="h-4 w-4" />
      </IconButton>
      {open ? (
        <div
          role="dialog"
          aria-label="Map layers"
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 shadow-[var(--elevation-3)]"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Layers
          </p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-muted)]">
            <input
              type="checkbox"
              checked={showMine}
              onChange={(e) => onChange({ mine: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            <span className="text-sm font-medium text-[var(--color-ink)]">
              My places
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-muted)]">
            <input
              type="checkbox"
              checked={showCommunity}
              onChange={(e) => onChange({ community: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            <span className="text-sm font-medium text-[var(--color-ink)]">
              Community
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-muted)]">
            <input
              type="checkbox"
              checked={showDiscover}
              onChange={(e) => onChange({ discover: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            <span className="text-sm font-medium text-[var(--color-ink)]">
              Nearby discovery
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
