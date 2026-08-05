"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { PetPolicyReport } from "@/lib/policy/evidence";
import { cn } from "@/lib/utils";

type Props = {
  reports: PetPolicyReport[];
  loading?: boolean;
  placeId?: string | null;
  /** Concurrent trip-report UI can replace the default list. */
  slot?: React.ReactNode;
  onAddTripReport?: () => void;
  className?: string;
};

const STATUS_LABEL: Record<PetPolicyReport["overallStatus"], string> = {
  confirmed: "Dogs welcome",
  restricted: "Restrictions",
  ask_first: "Ask first",
  unknown: "Unclear",
  not_allowed: "Not allowed",
};

function formatVisit(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

/**
 * Community trip reports feed — journal style, not chat.
 */
export function PlaceTripReportsFeed({
  reports,
  loading,
  placeId,
  slot,
  onAddTripReport,
  className,
}: Props) {
  if (slot) {
    return <section className={className}>{slot}</section>;
  }

  const publicReports = reports.filter((r) => r.visibility === "public");

  return (
    <section className={cn("space-y-3", className)} aria-label="Trip reports">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          Trip reports
        </h3>
        {onAddTripReport && placeId ? (
          <button
            type="button"
            onClick={onAddTripReport}
            className="text-sm font-semibold text-[var(--color-brand)]"
          >
            Add report
          </button>
        ) : null}
      </div>

      {!placeId ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Save this place to Dogmarked to collect trip reports.
        </p>
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : publicReports.length === 0 ? (
        <EmptyState
          title="No trip reports yet"
          description="Be the first to share what it was like visiting with dogs."
          category="hotel"
          className="py-6"
          action={
            onAddTripReport ? (
              <button
                type="button"
                onClick={onAddTripReport}
                className="text-sm font-semibold text-[var(--color-brand)]"
              >
                Add a trip report
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {publicReports.slice(0, 8).map((r) => {
            const when = formatVisit(r.visitedOn ?? r.createdAt);
            return (
              <li key={r.id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-[var(--color-ink)]">
                    {STATUS_LABEL[r.overallStatus]}
                  </span>
                  {when ? (
                    <span className="text-xs text-[var(--color-ink-muted)]">
                      {when}
                    </span>
                  ) : null}
                </div>
                {r.note ? (
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {r.note}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
