/**
 * Structured dog-policy trip reports and place-level summary derivation.
 * Summaries use PUBLIC reports only; private rows never affect confirmation counts.
 */

export type PetPolicyOverallStatus =
  | "confirmed"
  | "restricted"
  | "ask_first"
  | "unknown"
  | "not_allowed";

export type PetPolicyReportVisibility = "private" | "public";

export type PetPolicyEvidenceType =
  | "firsthand_visit"
  | "official_policy"
  | "direct_confirmation"
  | "provider_listing"
  | "other";

export type PetSizeBucket = "small" | "medium" | "large";

export type PetPolicyAreas = {
  guestRooms?: boolean;
  indoorPublicAreas?: boolean;
  indoorDining?: boolean;
  outdoorDining?: boolean;
  grounds?: boolean;
  beach?: boolean;
  poolArea?: boolean;
  transitCabin?: boolean;
};

export type PetPolicyRules = {
  leashRequired?: boolean;
  carrierRequired?: boolean;
  priorApprovalRequired?: boolean;
  breedRestrictions?: boolean;
  mayBeLeftUnattended?: boolean;
};

export type PetPolicyFee = {
  amount?: number;
  currency?: string;
  basis?: "per_pet" | "per_night" | "per_stay" | "deposit";
  refundable?: boolean;
};

export type PetPolicyReport = {
  id: string;
  placeId: string;
  userId: string;
  petIds: string[];
  visitedOn?: string | null;
  visibility: PetPolicyReportVisibility;
  overallStatus: PetPolicyOverallStatus;
  allowedSizes?: PetSizeBucket[];
  weightLimitLb?: number | null;
  maxDogs?: number | null;
  areas?: PetPolicyAreas;
  rules?: PetPolicyRules;
  fee?: PetPolicyFee | null;
  note?: string | null;
  evidenceType: PetPolicyEvidenceType;
  evidenceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Official / retrieved source row (extends legacy policy_evidence). */
export type PolicyEvidence = {
  id: string;
  placeId: string;
  reportId?: string | null;
  contributionId?: string | null;
  kind: string;
  url?: string | null;
  note?: string | null;
  excerpt?: string | null;
  retrievedAt?: string | null;
  sourceTitle?: string | null;
  isOfficial: boolean;
  createdBy?: string | null;
  createdAt: string;
};

export type PolicyConflictField =
  | "overallStatus"
  | "allowedSizes"
  | "maxDogs"
  | "weightLimitLb"
  | "areas"
  | "rules"
  | "fee";

export type PolicyConflict = {
  field: PolicyConflictField;
  values: unknown[];
};

export type PlacePolicySummary = {
  overallStatus: PetPolicyOverallStatus;
  confirmationCount: number;
  recentVisitCount: number;
  lastConfirmed: string | null;
  hasOfficialSource: boolean;
  conflicts: PolicyConflict[];
  staleWarning: boolean;
  publicReportCount: number;
};

export const DEFAULT_STALE_AFTER_DAYS = 365;
export const RECENT_VISIT_DAYS = 180;

const STATUS_RANK: Record<PetPolicyOverallStatus, number> = {
  not_allowed: 0,
  ask_first: 1,
  restricted: 2,
  unknown: 3,
  confirmed: 4,
};

function reportTimestamp(report: PetPolicyReport): number {
  const raw = report.visitedOn ?? report.createdAt;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function daysBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24);
}

function uniqueJsonValues(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const v of values) {
    const key = JSON.stringify(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function areaSignature(areas: PetPolicyAreas | undefined): string | null {
  if (!areas) return null;
  const keys = Object.keys(areas).sort() as (keyof PetPolicyAreas)[];
  const meaningful = keys.filter((k) => typeof areas[k] === "boolean");
  if (meaningful.length === 0) return null;
  return JSON.stringify(
    Object.fromEntries(meaningful.map((k) => [k, areas[k]])),
  );
}

function rulesSignature(rules: PetPolicyRules | undefined): string | null {
  if (!rules) return null;
  const keys = Object.keys(rules).sort() as (keyof PetPolicyRules)[];
  const meaningful = keys.filter((k) => typeof rules[k] === "boolean");
  if (meaningful.length === 0) return null;
  return JSON.stringify(
    Object.fromEntries(meaningful.map((k) => [k, rules[k]])),
  );
}

function feeSignature(fee: PetPolicyFee | null | undefined): string | null {
  if (!fee || (fee.amount == null && !fee.basis && fee.refundable == null)) {
    return null;
  }
  return JSON.stringify({
    amount: fee.amount ?? null,
    currency: fee.currency ?? null,
    basis: fee.basis ?? null,
    refundable: fee.refundable ?? null,
  });
}

function detectConflicts(publicReports: PetPolicyReport[]): PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];

  const statuses = uniqueJsonValues(
    publicReports
      .map((r) => r.overallStatus)
      .filter((s) => s !== "unknown"),
  ) as PetPolicyOverallStatus[];
  if (statuses.length > 1) {
    conflicts.push({ field: "overallStatus", values: statuses });
  }

  const sizeSets = uniqueJsonValues(
    publicReports
      .map((r) => [...(r.allowedSizes ?? [])].sort())
      .filter((s) => s.length > 0),
  );
  if (sizeSets.length > 1) {
    conflicts.push({ field: "allowedSizes", values: sizeSets });
  }

  const maxDogs = uniqueJsonValues(
    publicReports.map((r) => r.maxDogs).filter((v): v is number => v != null),
  );
  if (maxDogs.length > 1) {
    conflicts.push({ field: "maxDogs", values: maxDogs });
  }

  const weights = uniqueJsonValues(
    publicReports
      .map((r) => r.weightLimitLb)
      .filter((v): v is number => v != null),
  );
  if (weights.length > 1) {
    conflicts.push({ field: "weightLimitLb", values: weights });
  }

  const areaSigs = uniqueJsonValues(
    publicReports
      .map((r) => areaSignature(r.areas))
      .filter((s): s is string => s != null)
      .map((s) => JSON.parse(s) as PetPolicyAreas),
  );
  if (areaSigs.length > 1) {
    conflicts.push({ field: "areas", values: areaSigs });
  }

  const ruleSigs = uniqueJsonValues(
    publicReports
      .map((r) => rulesSignature(r.rules))
      .filter((s): s is string => s != null)
      .map((s) => JSON.parse(s) as PetPolicyRules),
  );
  if (ruleSigs.length > 1) {
    conflicts.push({ field: "rules", values: ruleSigs });
  }

  const feeSigs = uniqueJsonValues(
    publicReports
      .map((r) => feeSignature(r.fee))
      .filter((s): s is string => s != null)
      .map((s) => JSON.parse(s) as PetPolicyFee),
  );
  if (feeSigs.length > 1) {
    conflicts.push({ field: "fee", values: feeSigs });
  }

  return conflicts;
}

/**
 * Pick a display status without overwriting disagreements.
 * Most-recent public report wins for the headline; conflicts are surfaced separately.
 */
function pickOverallStatus(
  publicReports: PetPolicyReport[],
  conflicts: PolicyConflict[],
): PetPolicyOverallStatus {
  if (publicReports.length === 0) return "unknown";

  const sorted = [...publicReports].sort(
    (a, b) => reportTimestamp(b) - reportTimestamp(a),
  );
  const latest = sorted[0]!;
  if (latest.overallStatus !== "unknown") return latest.overallStatus;

  const latestKnown = sorted.find((r) => r.overallStatus !== "unknown");
  if (latestKnown) return latestKnown.overallStatus;

  // No known statuses — if only conflicts somehow empty, stay unknown
  void conflicts;
  return "unknown";
}

export type DeriveSummaryOptions = {
  now?: Date;
  staleAfterDays?: number;
  recentVisitDays?: number;
  /** Extra official evidence rows (public) for hasOfficialSource */
  officialEvidence?: Array<Pick<PolicyEvidence, "isOfficial" | "url" | "excerpt">>;
};

/**
 * Derive place-level summary from reports.
 * Private reports are excluded entirely from counts, freshness, and conflicts.
 */
export function deriveSummary(
  reports: PetPolicyReport[],
  options: DeriveSummaryOptions = {},
): PlacePolicySummary {
  const now = options.now ?? new Date();
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const recentVisitDays = options.recentVisitDays ?? RECENT_VISIT_DAYS;

  const publicReports = reports.filter((r) => r.visibility === "public");
  const confirmed = publicReports.filter((r) => r.overallStatus === "confirmed");

  const confirmationCount = confirmed.length;

  let lastConfirmed: string | null = null;
  let lastConfirmedMs = -Infinity;
  for (const r of confirmed) {
    const ms = reportTimestamp(r);
    if (ms >= lastConfirmedMs) {
      lastConfirmedMs = ms;
      lastConfirmed = r.visitedOn ?? r.createdAt;
    }
  }

  const recentVisitCount = publicReports.filter((r) => {
    const ms = reportTimestamp(r);
    if (!ms) return false;
    return daysBetween(now, new Date(ms)) <= recentVisitDays;
  }).length;

  const hasOfficialFromReports = publicReports.some(
    (r) => r.evidenceType === "official_policy",
  );
  const hasOfficialFromEvidence = (options.officialEvidence ?? []).some(
    (e) => e.isOfficial && (Boolean(e.url) || Boolean(e.excerpt)),
  );

  const conflicts = detectConflicts(publicReports);
  const overallStatus = pickOverallStatus(publicReports, conflicts);

  let staleWarning = false;
  if (confirmationCount > 0 && lastConfirmed) {
    const age = daysBetween(now, new Date(Date.parse(lastConfirmed)));
    staleWarning = age > staleAfterDays;
  } else if (publicReports.length > 0) {
    const newest = Math.max(...publicReports.map(reportTimestamp));
    if (newest > 0) {
      staleWarning = daysBetween(now, new Date(newest)) > staleAfterDays;
    }
  }

  return {
    overallStatus,
    confirmationCount,
    recentVisitCount,
    lastConfirmed,
    hasOfficialSource: hasOfficialFromReports || hasOfficialFromEvidence,
    conflicts,
    staleWarning,
    publicReportCount: publicReports.length,
  };
}

/** Severity helper for UI (lower = stricter). */
export function overallStatusRank(status: PetPolicyOverallStatus): number {
  return STATUS_RANK[status];
}

export function isPublicReport(report: PetPolicyReport): boolean {
  return report.visibility === "public";
}
