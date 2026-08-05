"use client";

import { useState } from "react";
import type { PetPolicyReport } from "@/lib/policy/evidence";
import { TripReportActions } from "@/components/trip-report/trip-report-actions";
import { TripReportFeed } from "@/components/trip-report/trip-report-feed";
import { TripReportForm } from "@/components/trip-report/trip-report-form";
import type { PetOption, TripReportMode } from "@/components/trip-report/types";

export type TripReportPanelProps = {
  placeId?: string | null;
  placeName?: string;
  pets?: PetOption[];
  petIds?: string[];
  className?: string;
  /** When set, opens that mode immediately (controlled). */
  mode?: TripReportMode | null;
  onModeChange?: (mode: TripReportMode | null) => void;
  /** Include journal feed (default true). Set false when host already renders one. */
  showFeed?: boolean;
  onReportSaved?: (report: PetPolicyReport) => void;
};

/**
 * Embeddable place-card block: actions + form + optional journal feed.
 * Safe when Phase 9 rich card is not ready yet.
 */
export function TripReportPanel({
  placeId,
  placeName,
  pets,
  petIds,
  className,
  mode: modeProp,
  onModeChange,
  showFeed = true,
  onReportSaved,
}: TripReportPanelProps) {
  const [internalMode, setInternalMode] = useState<TripReportMode | null>(null);
  const mode = modeProp !== undefined ? modeProp : internalMode;
  const setMode = (next: TripReportMode | null) => {
    if (modeProp === undefined) setInternalMode(next);
    onModeChange?.(next);
  };
  const [feedKey, setFeedKey] = useState(0);

  return (
    <div className={className}>
      {mode && placeId ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <TripReportForm
            key={mode}
            placeId={placeId}
            placeName={placeName}
            mode={mode}
            pets={pets}
            petIds={petIds}
            onCancel={() => setMode(null)}
            onSaved={(report) => {
              setMode(null);
              setFeedKey((k) => k + 1);
              onReportSaved?.(report);
            }}
          />
        </div>
      ) : (
        <TripReportActions
          disabled={!placeId}
          disabledHint="Save this place first to add trip reports and sources."
          onSelect={setMode}
        />
      )}

      {showFeed ? (
        <div className="mt-5">
          <TripReportFeed key={feedKey} placeId={placeId} />
        </div>
      ) : null}
    </div>
  );
}
