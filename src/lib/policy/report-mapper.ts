import type {
  PetPolicyAreas,
  PetPolicyEvidenceType,
  PetPolicyFee,
  PetPolicyOverallStatus,
  PetPolicyReport,
  PetPolicyReportVisibility,
  PetPolicyRules,
  PetSizeBucket,
} from "@/lib/policy/evidence";

const OVERALL_STATUSES = new Set<PetPolicyOverallStatus>([
  "confirmed",
  "restricted",
  "ask_first",
  "unknown",
  "not_allowed",
]);

const EVIDENCE_TYPES = new Set<PetPolicyEvidenceType>([
  "firsthand_visit",
  "official_policy",
  "direct_confirmation",
  "provider_listing",
  "other",
]);

const SIZE_BUCKETS = new Set<PetSizeBucket>(["small", "medium", "large"]);

export type PetPolicyReportRow = {
  id: string;
  place_id: string;
  user_id: string;
  pet_ids: string[] | null;
  visited_on: string | null;
  visibility: string;
  overall_status: string;
  allowed_sizes: string[] | null;
  weight_limit_lb: number | string | null;
  max_dogs: number | null;
  areas: PetPolicyAreas | null;
  rules: PetPolicyRules | null;
  fee: PetPolicyFee | null;
  note: string | null;
  evidence_type: string;
  evidence_url: string | null;
  created_at: string;
  updated_at: string;
};

function asOverallStatus(value: string): PetPolicyOverallStatus {
  return OVERALL_STATUSES.has(value as PetPolicyOverallStatus)
    ? (value as PetPolicyOverallStatus)
    : "unknown";
}

function asEvidenceType(value: string): PetPolicyEvidenceType {
  return EVIDENCE_TYPES.has(value as PetPolicyEvidenceType)
    ? (value as PetPolicyEvidenceType)
    : "other";
}

function asVisibility(value: string): PetPolicyReportVisibility {
  return value === "public" ? "public" : "private";
}

function asSizes(raw: string[] | null | undefined): PetSizeBucket[] {
  return (raw ?? []).filter((s): s is PetSizeBucket =>
    SIZE_BUCKETS.has(s as PetSizeBucket),
  );
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapReportRow(row: PetPolicyReportRow): PetPolicyReport {
  return {
    id: row.id,
    placeId: row.place_id,
    userId: row.user_id,
    petIds: row.pet_ids ?? [],
    visitedOn: row.visited_on,
    visibility: asVisibility(row.visibility),
    overallStatus: asOverallStatus(row.overall_status),
    allowedSizes: asSizes(row.allowed_sizes),
    weightLimitLb: asNumber(row.weight_limit_lb),
    maxDogs: row.max_dogs,
    areas: row.areas ?? {},
    rules: row.rules ?? {},
    fee: row.fee,
    note: row.note,
    evidenceType: asEvidenceType(row.evidence_type),
    evidenceUrl: row.evidence_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function reportToInsert(input: {
  placeId: string;
  userId: string;
  petIds?: string[];
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
}) {
  return {
    place_id: input.placeId,
    user_id: input.userId,
    pet_ids: input.petIds ?? [],
    visited_on: input.visitedOn ?? null,
    visibility: input.visibility,
    overall_status: input.overallStatus,
    allowed_sizes: input.allowedSizes ?? [],
    weight_limit_lb: input.weightLimitLb ?? null,
    max_dogs: input.maxDogs ?? null,
    areas: input.areas ?? {},
    rules: input.rules ?? {},
    fee: input.fee ?? null,
    note: input.note ?? null,
    evidence_type: input.evidenceType,
    evidence_url: input.evidenceUrl ?? null,
  };
}
