"use client";

import { useEffect, useState } from "react";
import type { PetPolicyReport, PlacePolicySummary } from "@/lib/policy/evidence";
import { chipsFromReport } from "@/lib/policy/chips";
import { PolicyChip } from "@/components/ui/policy-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type FeedTone =
  | "confirmed"
  | "restricted"
  | "community"
  | "unknown"
  | "not-allowed"
  | "neutral";

function chipTone(tone: string): FeedTone {
  switch (tone) {
    case "confirmed":
      return "confirmed";
    case "restricted":
      return "restricted";
    case "ask_first":
      return "community";
    case "not_allowed":
      return "not-allowed";
    case "unknown":
      return "unknown";
    default:
      return "neutral";
  }
}

function formatVisitDate(iso: string | null | undefined, fallback: string) {
  const raw = iso || fallback;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(raw.includes("T") ? raw : `${raw}T12:00:00`));
  } catch {
    return raw;
  }
}

export type TripReportFeedProps = {
  placeId: string | undefined | null;
  className?: string;
  /** Preloaded reports skip the fetch */
  initialReports?: PetPolicyReport[];
  title?: string;
};

/**
 * Journal-style public trip report feed for a place (not a chat thread).
 */
export function TripReportFeed({
  placeId,
  className,
  initialReports,
  title = "Trip reports",
}: TripReportFeedProps) {
  const [reports, setReports] = useState<PetPolicyReport[]>(
    initialReports ?? [],
  );
  const [summary, setSummary] = useState<PlacePolicySummary | null>(null);
  const [loading, setLoading] = useState(!initialReports && Boolean(placeId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!placeId || initialReports) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/pet-policy-reports?placeId=${encodeURIComponent(placeId)}`)
      .then(async (res) => {
        const json = (await res.json()) as {
          ok?: boolean;
          reports?: PetPolicyReport[];
          summary?: PlacePolicySummary;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Could not load reports.");
        if (cancelled) return;
        const publicOnly = (json.reports ?? []).filter(
          (r) => r.visibility === "public",
        );
        setReports(publicOnly);
        setSummary(json.summary ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [placeId, initialReports]);

  if (!placeId) {
    return (
      <section className={cn("space-y-2", className)}>
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Save this place to Dogmarked to collect trip reports.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
        {summary && summary.publicReportCount > 0 ? (
          <span className="text-xs text-[var(--color-text-muted)]">
            {summary.publicReportCount} public
            {summary.confirmationCount > 0
              ? ` · ${summary.confirmationCount} confirmed`
              : ""}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-[var(--color-surface-muted)]" />
          <div className="h-16 animate-pulse rounded-xl bg-[var(--color-surface-muted)]" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : reports.length === 0 ? (
        <EmptyState
          title="No trip reports yet"
          description="Be the first to document dog access here."
          category="hotel"
          className="py-6"
        />
      ) : (
        <ol className="relative space-y-0 border-l border-[var(--color-border)] pl-4">
          {reports.map((r) => {
            const chips = chipsFromReport(r).slice(0, 4);
            return (
              <li key={r.id} className="relative pb-5 last:pb-0">
                <span
                  aria-hidden
                  className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-brand-600)] ring-4 ring-[var(--color-surface)]"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {r.overallStatus.replace(/_/g, " ")}
                  </p>
                  <time
                    className="text-xs text-[var(--color-text-muted)]"
                    dateTime={r.visitedOn ?? r.createdAt}
                  >
                    {formatVisitDate(r.visitedOn, r.createdAt)}
                  </time>
                </div>
                {r.note ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text)]">
                    {r.note}
                  </p>
                ) : null}
                {chips.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((c) => (
                      <PolicyChip key={c.id} tone={chipTone(c.tone)}>
                        {c.label}
                      </PolicyChip>
                    ))}
                  </div>
                ) : null}
                {r.evidenceUrl ? (
                  <a
                    href={r.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-[var(--color-brand-600)]"
                  >
                    Source →
                  </a>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
