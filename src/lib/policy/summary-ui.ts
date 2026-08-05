import type { PolicyChipTone as UiChipTone } from "@/components/ui/policy-chip";
import type { StatusBadgeStatus } from "@/components/ui/status-badge";
import type { PolicyChipTone as ChipTone } from "@/lib/policy/chips";
import type {
  PetPolicyOverallStatus,
  PetPolicyReport,
  PlacePolicySummary,
} from "@/lib/policy/evidence";
import type { DogPolicy, DogStatus } from "@/lib/types";
import { lbToKg } from "@/lib/units";

const VERDICT_HEADLINE: Record<PetPolicyOverallStatus, string> = {
  confirmed: "Dogs welcome",
  restricted: "Dogs OK with restrictions",
  ask_first: "Ask before you go",
  unknown: "Dog policy unknown",
  not_allowed: "Dogs not allowed",
};

const VERDICT_SUPPORT: Record<PetPolicyOverallStatus, string> = {
  confirmed: "Travelers on Dogmarked have confirmed dogs are welcome here.",
  restricted: "Dogs are allowed with conditions — review the details below.",
  ask_first: "Policy isn’t settled. Confirm with the venue before you arrive.",
  unknown: "Not marked dog-friendly until Dogmarked has traveler evidence.",
  not_allowed: "Reports indicate dogs are not allowed at this place.",
};

export function verdictHeadline(status: PetPolicyOverallStatus): string {
  return VERDICT_HEADLINE[status];
}

export function verdictSupport(status: PetPolicyOverallStatus): string {
  return VERDICT_SUPPORT[status];
}

export function summaryToStatusBadge(
  status: PetPolicyOverallStatus,
): StatusBadgeStatus {
  switch (status) {
    case "confirmed":
      return "confirmed";
    case "restricted":
      return "restricted";
    case "ask_first":
      return "community";
    case "not_allowed":
      return "not-allowed";
    default:
      return "unknown";
  }
}

/** Map chips.ts tones onto PolicyChip UI tones. */
export function chipToneToUi(tone: ChipTone): UiChipTone {
  switch (tone) {
    case "ask_first":
      return "community";
    case "not_allowed":
      return "not-allowed";
    default:
      return tone;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Human evidence lines derived from a place summary (for the verdict block). */
export function evidenceLinesFromSummary(summary: PlacePolicySummary): string[] {
  const lines: string[] = [];

  if (summary.publicReportCount === 0) {
    return ["No public Dogmarked reports yet."];
  }

  if (summary.confirmationCount > 0) {
    lines.push(
      summary.confirmationCount === 1
        ? "1 traveler confirmed dogs welcome"
        : `${summary.confirmationCount} travelers confirmed dogs welcome`,
    );
  }

  if (summary.recentVisitCount > 0) {
    lines.push(
      summary.recentVisitCount === 1
        ? "1 recent visit report"
        : `${summary.recentVisitCount} recent visit reports`,
    );
  }

  if (summary.lastConfirmed) {
    lines.push(`Last confirmed ${formatShortDate(summary.lastConfirmed)}`);
  }

  if (summary.hasOfficialSource) {
    lines.push("Official policy source on file");
  }

  if (summary.conflicts.length > 0) {
    lines.push("Traveler reports disagree — double-check before you go");
  }

  if (summary.staleWarning) {
    lines.push("Evidence may be outdated");
  }

  if (lines.length === 0) {
    lines.push(
      summary.publicReportCount === 1
        ? "1 public trip report"
        : `${summary.publicReportCount} public trip reports`,
    );
  }

  return lines;
}

function overallToDogStatus(status: PetPolicyOverallStatus): DogStatus | null {
  switch (status) {
    case "confirmed":
      return "dogs_welcome";
    case "restricted":
      return "dogs_ok_with_restrictions";
    case "ask_first":
      return "ask_first";
    case "not_allowed":
      return "no_dogs";
    default:
      return null;
  }
}

/**
 * Build a lightweight DogPolicy for pack compatibility scoring from a summary
 * and optional sample public report (areas / size / rules).
 */
export function dogPolicyFromSummary(
  placeId: string,
  summary: PlacePolicySummary,
  sample?: PetPolicyReport | null,
): DogPolicy | null {
  const dogStatus = overallToDogStatus(summary.overallStatus);
  if (!dogStatus) return null;

  const access: string[] = [];
  if (sample?.areas) {
    if (sample.areas.indoorDining) access.push("indoor");
    if (sample.areas.outdoorDining || sample.areas.grounds) access.push("outdoor");
    if (sample.areas.guestRooms) access.push("rooms");
  }

  return {
    placeId,
    dogStatus,
    access,
    maxDogs: sample?.maxDogs ?? null,
    maxWeightKg:
      sample?.weightLimitLb != null ? lbToKg(sample.weightLimitLb) : null,
    maxCombinedWeightKg: null,
    smallDogsOnly: Boolean(
      sample?.allowedSizes?.length === 1 && sample.allowedSizes[0] === "small",
    ),
    carrierRequired: Boolean(sample?.rules?.carrierRequired),
    leashRequired: sample?.rules?.leashRequired !== false,
    advanceApprovalRequired: Boolean(sample?.rules?.priorApprovalRequired),
    feeType: sample?.fee?.amount != null ? "flat" : "unknown",
    feeAmount: sample?.fee?.amount ?? null,
    feeCurrency: sample?.fee?.currency ?? null,
    exceptionText: sample?.note ?? null,
    seasonalNotes: null,
    seasonalStartMonth: null,
    seasonalEndMonth: null,
    sourceType: sample?.evidenceType ?? "community",
    sourceUrl: sample?.evidenceUrl ?? null,
    confidence: summary.confirmationCount > 0 ? 0.7 : 0.4,
    lastVerifiedAt: summary.lastConfirmed,
  };
}

export const POLICY_CHIP_GROUP_ORDER = [
  "access",
  "size",
  "areas",
  "rules",
] as const;

export const POLICY_CHIP_GROUP_LABELS: Record<
  (typeof POLICY_CHIP_GROUP_ORDER)[number],
  string
> = {
  access: "Access",
  size: "Size",
  areas: "Areas",
  rules: "Rules",
};
