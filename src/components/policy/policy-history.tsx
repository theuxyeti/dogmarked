"use client";

export interface PolicyVersionItem {
  id: string;
  dogStatus: string;
  access: string[];
  maxDogs: number | null;
  exceptionText: string | null;
  confidence: number | null;
  lastVerifiedAt: string | null;
  snapshotAt: string;
  promotedFromContributionId: string | null;
}

export interface PolicyHistoryProps {
  versions: PolicyVersionItem[];
  emptyLabel?: string;
}

/**
 * Append-only policy version list (dog_policy_versions).
 * Canonical writes remain server-only; this UI is read-only.
 */
export function PolicyHistory({
  versions,
  emptyLabel = "No policy versions yet.",
}: PolicyHistoryProps) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-[var(--ink,#1c2421)]/55">{emptyLabel}</p>
    );
  }

  const sorted = [...versions].sort(
    (a, b) =>
      new Date(b.snapshotAt).getTime() - new Date(a.snapshotAt).getTime(),
  );

  return (
    <ol className="relative flex flex-col gap-0 border-l border-[var(--ink,#1c2421)]/15 pl-4">
      {sorted.map((v, i) => (
        <li key={v.id} className="relative pb-6 last:pb-0">
          <span
            aria-hidden
            className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--teal,#0f5c56)] ring-4 ring-[var(--paper,#f7f4ef)]"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-[var(--ink,#1c2421)]">
              {formatStatus(v.dogStatus)}
              {i === 0 ? (
                <span className="ml-2 text-xs font-normal uppercase tracking-wide text-[var(--teal,#0f5c56)]">
                  Current
                </span>
              ) : null}
            </p>
            <time
              className="text-xs text-[var(--ink,#1c2421)]/50"
              dateTime={v.snapshotAt}
            >
              {formatDate(v.snapshotAt)}
            </time>
          </div>
          <p className="mt-1 text-xs text-[var(--ink,#1c2421)]/60">
            Access: {v.access.length ? v.access.join(", ") : "—"}
            {v.maxDogs != null ? ` · Max dogs ${v.maxDogs}` : ""}
            {v.confidence != null
              ? ` · Confidence ${Math.round(v.confidence * 100)}%`
              : ""}
          </p>
          {v.exceptionText ? (
            <p className="mt-2 text-sm text-[var(--ink,#1c2421)]/75">
              Exception: {v.exceptionText}
            </p>
          ) : null}
          {v.lastVerifiedAt ? (
            <p className="mt-1 text-xs text-[var(--ink,#1c2421)]/45">
              Last verified {formatDate(v.lastVerifiedAt)}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
