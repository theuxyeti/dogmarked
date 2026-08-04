/**
 * Moderation helpers: conflict detection and resolution planning.
 * Canonical policy mutation stays server-side (RPC / Edge Function).
 */

export type ModerationStatus =
  | "draft"
  | "in_review"
  | "published"
  | "rejected";

export interface PolicySnapshot {
  dogStatus: string;
  access: string[];
  maxDogs: number | null;
  maxWeightKg: number | null;
  maxCombinedWeightKg: number | null;
  smallDogsOnly: boolean;
  carrierRequired: boolean;
  leashRequired: boolean;
  advanceApprovalRequired: boolean;
  feeType: string;
  feeAmount: number | null;
  feeCurrency: string | null;
  exceptionText: string | null;
}

export interface ContributionForModeration extends PolicySnapshot {
  id: string;
  placeId: string;
  userId: string;
  moderationStatus: ModerationStatus;
  sourceType: string;
  sourceUrl: string | null;
  observedAt: string | null;
  createdAt: string;
}

export type ConflictField =
  | "dogStatus"
  | "access"
  | "maxDogs"
  | "maxWeightKg"
  | "maxCombinedWeightKg"
  | "smallDogsOnly"
  | "carrierRequired"
  | "leashRequired"
  | "advanceApprovalRequired"
  | "feeType"
  | "feeAmount"
  | "exceptionText";

export interface PolicyConflict {
  field: ConflictField;
  canonical: unknown;
  incoming: unknown;
}

export interface ConflictResolutionPlan {
  action: "promote" | "reject" | "needs_human_review";
  conflicts: PolicyConflict[];
  summary: string;
}

function sortedAccess(access: string[]): string[] {
  return [...access].map((a) => a.toLowerCase()).sort();
}

function normText(v: string | null | undefined): string {
  return (v ?? "").trim();
}

export function detectPolicyConflicts(
  canonical: PolicySnapshot | null,
  incoming: PolicySnapshot,
): PolicyConflict[] {
  if (!canonical) return [];

  const conflicts: PolicyConflict[] = [];

  const check = (field: ConflictField, a: unknown, b: unknown) => {
    const equal =
      field === "access"
        ? JSON.stringify(sortedAccess(a as string[])) ===
          JSON.stringify(sortedAccess(b as string[]))
        : a === b;
    if (!equal) conflicts.push({ field, canonical: a, incoming: b });
  };

  check("dogStatus", canonical.dogStatus, incoming.dogStatus);
  check("access", canonical.access, incoming.access);
  check("maxDogs", canonical.maxDogs, incoming.maxDogs);
  check("maxWeightKg", canonical.maxWeightKg, incoming.maxWeightKg);
  check(
    "maxCombinedWeightKg",
    canonical.maxCombinedWeightKg,
    incoming.maxCombinedWeightKg,
  );
  check("smallDogsOnly", canonical.smallDogsOnly, incoming.smallDogsOnly);
  check("carrierRequired", canonical.carrierRequired, incoming.carrierRequired);
  check("leashRequired", canonical.leashRequired, incoming.leashRequired);
  check(
    "advanceApprovalRequired",
    canonical.advanceApprovalRequired,
    incoming.advanceApprovalRequired,
  );
  check("feeType", canonical.feeType, incoming.feeType);
  check("feeAmount", canonical.feeAmount, incoming.feeAmount);
  check(
    "exceptionText",
    normText(canonical.exceptionText),
    normText(incoming.exceptionText),
  );

  return conflicts;
}

/** High-severity disagreements that should not auto-promote. */
const HARD_FIELDS: ConflictField[] = [
  "dogStatus",
  "maxDogs",
  "carrierRequired",
  "smallDogsOnly",
];

export function planConflictResolution(
  canonical: PolicySnapshot | null,
  incoming: ContributionForModeration,
): ConflictResolutionPlan {
  if (incoming.moderationStatus === "rejected") {
    return {
      action: "reject",
      conflicts: [],
      summary: "Contribution already rejected.",
    };
  }

  const conflicts = detectPolicyConflicts(canonical, incoming);

  if (!canonical) {
    return {
      action: "promote",
      conflicts: [],
      summary: "No canonical policy — first publish may promote.",
    };
  }

  if (conflicts.length === 0) {
    return {
      action: "promote",
      conflicts: [],
      summary: "Matches canonical; safe to refresh verification metadata.",
    };
  }

  const hard = conflicts.filter((c) => HARD_FIELDS.includes(c.field));
  if (hard.length > 0) {
    return {
      action: "needs_human_review",
      conflicts,
      summary: `Hard conflict on ${hard.map((c) => c.field).join(", ")}.`,
    };
  }

  return {
    action: "needs_human_review",
    conflicts,
    summary: `${conflicts.length} soft field conflict(s); moderator should choose promote path.`,
  };
}

export function sortModerationQueue(
  items: ContributionForModeration[],
): ContributionForModeration[] {
  const rank: Record<ModerationStatus, number> = {
    in_review: 0,
    draft: 1,
    published: 2,
    rejected: 3,
  };
  return [...items].sort((a, b) => {
    const r = rank[a.moderationStatus] - rank[b.moderationStatus];
    if (r !== 0) return r;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
