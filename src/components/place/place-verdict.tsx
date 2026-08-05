import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlacePolicySummary } from "@/lib/policy/evidence";
import {
  evidenceLinesFromSummary,
  summaryToStatusBadge,
  verdictHeadline,
  verdictSupport,
} from "@/lib/policy/summary-ui";
import { cn } from "@/lib/utils";

type Props = {
  summary: PlacePolicySummary | null;
  loading?: boolean;
  className?: string;
};

/**
 * Dogmarked verdict — distinctive field-guide block (not an error alert).
 */
export function PlaceVerdict({ summary, loading, className }: Props) {
  if (loading) {
    return (
      <div className={cn("space-y-2 rounded-xl p-3", className)}>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  const status = summary?.overallStatus ?? "unknown";
  const lines = summary
    ? evidenceLinesFromSummary(summary)
    : ["No public Dogmarked reports yet."];

  const soft =
    status === "confirmed"
      ? "bg-[var(--policy-confirmed-soft)]"
      : status === "restricted"
        ? "bg-[var(--policy-restricted-soft)]"
        : status === "ask_first"
          ? "bg-[var(--policy-community-soft)]"
          : status === "not_allowed"
            ? "bg-[var(--policy-not-allowed-soft)]"
            : "bg-[var(--policy-unknown-soft)]";

  const accent =
    status === "confirmed"
      ? "var(--policy-confirmed)"
      : status === "restricted"
        ? "var(--policy-restricted)"
        : status === "ask_first"
          ? "var(--policy-community)"
          : status === "not_allowed"
            ? "var(--policy-not-allowed)"
            : "var(--policy-unknown)";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl px-3.5 py-3",
        soft,
        className,
      )}
      aria-label="Dogmarked verdict"
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="pl-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg text-[var(--color-ink)]">
            {verdictHeadline(status)}
          </h3>
          <StatusBadge status={summaryToStatusBadge(status)} />
        </div>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {verdictSupport(status)}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink)]">
          {lines.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
