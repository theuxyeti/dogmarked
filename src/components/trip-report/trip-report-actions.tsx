"use client";

import { Button } from "@/components/ui/button";
import type { TripReportMode } from "@/components/trip-report/types";
import { cn } from "@/lib/utils";

const ACTIONS: { mode: TripReportMode; label: string; primary?: boolean }[] = [
  { mode: "trip_report", label: "Add a trip report", primary: true },
  { mode: "confirm", label: "Confirm this policy" },
  { mode: "report_change", label: "Report a change" },
  { mode: "add_source", label: "Add a policy source" },
];

export type TripReportActionsProps = {
  onSelect: (mode: TripReportMode) => void;
  className?: string;
  /** Disable when place is not yet saved (no placeId). */
  disabled?: boolean;
  disabledHint?: string;
};

/**
 * Place-card entry points for policy contribution modes.
 */
export function TripReportActions({
  onSelect,
  className,
  disabled,
  disabledHint,
}: TripReportActionsProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button
            key={a.mode}
            type="button"
            size="sm"
            variant={a.primary ? "action" : "outline"}
            disabled={disabled}
            onClick={() => onSelect(a.mode)}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {disabled && disabledHint ? (
        <p className="text-xs text-[var(--color-text-muted)]">{disabledHint}</p>
      ) : null}
    </div>
  );
}
