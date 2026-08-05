"use client";

import { useState } from "react";
import { PolicyChip } from "@/components/ui/policy-chip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chipsFromSummary,
  type PolicyChipCategory,
  type PolicyChipDescriptor,
} from "@/lib/policy/chips";
import type { PetPolicyReport, PlacePolicySummary } from "@/lib/policy/evidence";
import {
  POLICY_CHIP_GROUP_LABELS,
  POLICY_CHIP_GROUP_ORDER,
  chipToneToUi,
} from "@/lib/policy/summary-ui";
import { cn } from "@/lib/utils";

const TOP_COUNT = 6;

type Props = {
  summary: PlacePolicySummary | null;
  sampleReport?: PetPolicyReport | null;
  loading?: boolean;
  className?: string;
};

function groupChips(chips: PolicyChipDescriptor[]) {
  const groups = new Map<PolicyChipCategory, PolicyChipDescriptor[]>();
  for (const cat of POLICY_CHIP_GROUP_ORDER) groups.set(cat, []);
  for (const chip of chips) {
    groups.get(chip.category)?.push(chip);
  }
  return groups;
}

export function PlacePolicyChips({
  summary,
  sampleReport,
  loading,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
    );
  }

  if (!summary || summary.publicReportCount === 0) {
    return (
      <section className={cn("space-y-2", className)}>
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">Policy</h3>
        <p className="text-sm text-[var(--color-ink-muted)]">
          No structured policy chips yet. Save a visit or add a trip report to
          help the next traveler.
        </p>
      </section>
    );
  }

  const chips = chipsFromSummary(summary, sampleReport);
  const visible = expanded ? chips : chips.slice(0, TOP_COUNT);
  const groups = groupChips(visible);
  const hasMore = chips.length > TOP_COUNT;

  return (
    <section className={cn("space-y-3", className)} aria-label="Dog policy chips">
      <h3 className="text-sm font-semibold text-[var(--color-ink)]">Policy</h3>
      <div className="space-y-3">
        {POLICY_CHIP_GROUP_ORDER.map((cat) => {
          const list = groups.get(cat) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={cat}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                {POLICY_CHIP_GROUP_LABELS[cat]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((chip) => (
                  <PolicyChip key={chip.id} tone={chipToneToUi(chip.tone)}>
                    {chip.label}
                  </PolicyChip>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {hasMore ? (
        <button
          type="button"
          className="text-sm font-semibold text-[var(--color-brand)]"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "View full policy"}
        </button>
      ) : null}
    </section>
  );
}
