import type {
  PetPolicyAreas,
  PetPolicyOverallStatus,
  PetPolicyReport,
  PetPolicyRules,
  PlacePolicySummary,
  PetSizeBucket,
} from "@/lib/policy/evidence";

export type PolicyChipCategory = "access" | "size" | "areas" | "rules";

export type PolicyChipTone =
  | "confirmed"
  | "restricted"
  | "ask_first"
  | "not_allowed"
  | "unknown"
  | "neutral";

export type PolicyChipDescriptor = {
  id: string;
  category: PolicyChipCategory;
  label: string;
  tone: PolicyChipTone;
};

const ACCESS_LABELS: Record<PetPolicyOverallStatus, string> = {
  confirmed: "Dogs welcome",
  restricted: "Dogs with restrictions",
  ask_first: "Ask first",
  unknown: "Policy unknown",
  not_allowed: "Dogs not allowed",
};

const ACCESS_TONE: Record<PetPolicyOverallStatus, PolicyChipTone> = {
  confirmed: "confirmed",
  restricted: "restricted",
  ask_first: "ask_first",
  unknown: "unknown",
  not_allowed: "not_allowed",
};

const SIZE_LABELS: Record<PetSizeBucket, string> = {
  small: "Small dogs",
  medium: "Medium dogs",
  large: "Large dogs",
};

const AREA_LABELS: Record<keyof PetPolicyAreas, string> = {
  guestRooms: "Guest rooms",
  indoorPublicAreas: "Indoor public areas",
  indoorDining: "Indoor dining",
  outdoorDining: "Outdoor dining",
  grounds: "Grounds",
  beach: "Beach",
  poolArea: "Pool area",
  transitCabin: "Cabin / cabin seating",
};

const RULE_TRUE_LABELS: Partial<Record<keyof PetPolicyRules, string>> = {
  leashRequired: "Leash required",
  carrierRequired: "Carrier required",
  priorApprovalRequired: "Prior approval",
  breedRestrictions: "Breed restrictions",
  mayBeLeftUnattended: "May be left unattended",
};

function accessChip(status: PetPolicyOverallStatus): PolicyChipDescriptor {
  return {
    id: `access:${status}`,
    category: "access",
    label: ACCESS_LABELS[status],
    tone: ACCESS_TONE[status],
  };
}

function sizeChipsFromReport(report: PetPolicyReport): PolicyChipDescriptor[] {
  const chips: PolicyChipDescriptor[] = [];
  const sizes = report.allowedSizes ?? [];
  for (const size of sizes) {
    chips.push({
      id: `size:${size}`,
      category: "size",
      label: SIZE_LABELS[size],
      tone: "neutral",
    });
  }
  if (report.weightLimitLb != null) {
    chips.push({
      id: `size:weight:${report.weightLimitLb}`,
      category: "size",
      label: `Up to ${report.weightLimitLb} lb`,
      tone: "restricted",
    });
  }
  if (report.maxDogs != null) {
    chips.push({
      id: `size:maxDogs:${report.maxDogs}`,
      category: "size",
      label: report.maxDogs === 1 ? "1 dog max" : `${report.maxDogs} dogs max`,
      tone: "restricted",
    });
  }
  return chips;
}

function areaChips(areas: PetPolicyAreas | undefined): PolicyChipDescriptor[] {
  if (!areas) return [];
  const chips: PolicyChipDescriptor[] = [];
  for (const key of Object.keys(AREA_LABELS) as (keyof PetPolicyAreas)[]) {
    const value = areas[key];
    if (typeof value !== "boolean") continue;
    chips.push({
      id: `areas:${key}:${value ? "yes" : "no"}`,
      category: "areas",
      label: value ? AREA_LABELS[key] : `No ${AREA_LABELS[key].toLowerCase()}`,
      tone: value ? "confirmed" : "not_allowed",
    });
  }
  return chips;
}

function ruleChips(
  rules: PetPolicyRules | undefined,
  fee: PetPolicyReport["fee"],
): PolicyChipDescriptor[] {
  const chips: PolicyChipDescriptor[] = [];
  if (rules) {
    for (const key of Object.keys(RULE_TRUE_LABELS) as (keyof PetPolicyRules)[]) {
      if (rules[key] !== true) continue;
      const label = RULE_TRUE_LABELS[key];
      if (!label) continue;
      chips.push({
        id: `rules:${key}`,
        category: "rules",
        label,
        tone: key === "mayBeLeftUnattended" ? "confirmed" : "restricted",
      });
    }
  }
  if (fee && (fee.amount != null || fee.basis)) {
    const currency = fee.currency ?? "USD";
    const amount =
      fee.amount != null ? `${currency} ${fee.amount}` : "Pet fee";
    const basis = fee.basis ? ` (${fee.basis.replace(/_/g, " ")})` : "";
    chips.push({
      id: `rules:fee:${fee.amount ?? "x"}:${fee.basis ?? "x"}`,
      category: "rules",
      label: `${amount}${basis}`,
      tone: "restricted",
    });
  }
  return chips;
}

/** Map a single structured report to PolicyChip descriptors. */
export function chipsFromReport(report: PetPolicyReport): PolicyChipDescriptor[] {
  return [
    accessChip(report.overallStatus),
    ...sizeChipsFromReport(report),
    ...areaChips(report.areas),
    ...ruleChips(report.rules, report.fee),
  ];
}

/**
 * Map a place-level derived summary (+ optional sample public report for detail chips)
 * to PolicyChip descriptors. Conflicts add an access-adjacent warning chip.
 */
export function chipsFromSummary(
  summary: PlacePolicySummary,
  sampleReport?: PetPolicyReport | null,
): PolicyChipDescriptor[] {
  const chips: PolicyChipDescriptor[] = [accessChip(summary.overallStatus)];

  if (summary.conflicts.some((c) => c.field === "overallStatus")) {
    chips.push({
      id: "access:conflict",
      category: "access",
      label: "Reports disagree",
      tone: "ask_first",
    });
  }

  if (summary.staleWarning) {
    chips.push({
      id: "access:stale",
      category: "access",
      label: "Evidence may be stale",
      tone: "ask_first",
    });
  }

  if (summary.hasOfficialSource) {
    chips.push({
      id: "access:official",
      category: "access",
      label: "Official source",
      tone: "confirmed",
    });
  }

  if (sampleReport && sampleReport.visibility === "public") {
    chips.push(
      ...sizeChipsFromReport(sampleReport),
      ...areaChips(sampleReport.areas),
      ...ruleChips(sampleReport.rules, sampleReport.fee),
    );
  }

  // Dedupe by id while preserving order
  const seen = new Set<string>();
  return chips.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
