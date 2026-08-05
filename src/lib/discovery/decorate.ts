import type { PlaceCandidate } from "@/lib/discovery/types";
import {
  resolveMarkerPolicyStatus,
  type MarkerShellStatus,
} from "@/lib/map/marker-policy";
import {
  deriveSummary,
  type PetPolicyOverallStatus,
  type PetPolicyReport,
} from "@/lib/policy/evidence";
import { logServerError } from "@/lib/api-errors";

export type DecoratedCandidate = PlaceCandidate;

type ReportRow = {
  id: string;
  place_id: string;
  user_id: string;
  pet_ids?: string[] | null;
  visited_on?: string | null;
  visibility: string;
  overall_status: string;
  evidence_type?: string | null;
  created_at: string;
  updated_at: string;
};

function asOverall(raw: string): PetPolicyOverallStatus {
  if (
    raw === "confirmed" ||
    raw === "restricted" ||
    raw === "ask_first" ||
    raw === "not_allowed" ||
    raw === "unknown"
  ) {
    return raw;
  }
  return "unknown";
}

function rowsToReports(rows: ReportRow[]): PetPolicyReport[] {
  return rows.map((r) => ({
    id: String(r.id),
    placeId: String(r.place_id),
    userId: String(r.user_id),
    petIds: (r.pet_ids ?? []) as string[],
    visitedOn: r.visited_on ?? null,
    visibility: r.visibility === "public" ? "public" : "private",
    overallStatus: asOverall(String(r.overall_status)),
    evidenceType:
      (r.evidence_type as PetPolicyReport["evidenceType"]) ?? "firsthand_visit",
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

function statusForPlace(args: {
  placeId: string;
  reportsByPlace: Map<string, PetPolicyReport[]>;
  dogStatusByPlace: Map<string, string>;
  publicCount: number;
}): { policyStatus: MarkerShellStatus; overallStatus?: PetPolicyOverallStatus } {
  const reports = args.reportsByPlace.get(args.placeId) ?? [];
  let overallStatus: PetPolicyOverallStatus | undefined;
  if (reports.length > 0) {
    overallStatus = deriveSummary(reports).overallStatus;
  }

  const policyStatus = resolveMarkerPolicyStatus({
    overallStatus,
    dogStatus: args.dogStatusByPlace.get(args.placeId),
    communityReported: args.publicCount > 0 && (!overallStatus || overallStatus === "unknown"),
  });

  return { policyStatus, overallStatus };
}

/**
 * One batched Dogmarked lookup for nearby FSQ candidates.
 * Attaches canonical ids, thumbs, and Dogmarked policy status for markers/filters.
 * No N+1 queries. Never uses Foursquare friendliness.
 */
export async function decorateCandidatesWithDogmarked(
  candidates: PlaceCandidate[],
  userId?: string,
): Promise<DecoratedCandidate[]> {
  if (candidates.length === 0) return [];

  const fsqIds = candidates
    .filter((c) => c.provider === "foursquare")
    .map((c) => c.externalId);

  if (fsqIds.length === 0) return candidates;

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data: refs, error: refsErr } = await supabase
      .from("external_place_refs")
      .select("place_id, external_id, provider")
      .eq("provider", "foursquare")
      .in("external_id", fsqIds);

    if (refsErr) {
      logServerError("discovery.decorate.refs", refsErr);
      return candidates;
    }

    const byExternal = new Map(
      (refs ?? [])
        .filter((r) => r.place_id)
        .map((r) => [String(r.external_id), String(r.place_id)]),
    );
    const placeIds = [...new Set([...byExternal.values()])];
    if (placeIds.length === 0) return candidates;

    const [
      { data: places },
      { data: photos },
      { data: publicSaves },
      mySavesRes,
      { data: policies },
      reportsRes,
    ] = await Promise.all([
      supabase.from("places").select("id, slug, name").in("id", placeIds),
      supabase
        .from("place_photos")
        .select("place_id, storage_path, source_url, created_at")
        .in("place_id", placeIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_place_saves")
        .select("place_id")
        .eq("visibility", "public")
        .in("place_id", placeIds),
      userId
        ? supabase
            .from("user_place_saves")
            .select("place_id, status")
            .eq("user_id", userId)
            .in("place_id", placeIds)
        : Promise.resolve({ data: [] as Array<{ place_id: string; status: string }> }),
      supabase
        .from("dog_policies")
        .select("place_id, dog_status")
        .in("place_id", placeIds),
      supabase
        .from("pet_policy_reports")
        .select(
          "id, place_id, user_id, pet_ids, visited_on, visibility, overall_status, evidence_type, created_at, updated_at",
        )
        .eq("visibility", "public")
        .in("place_id", placeIds),
    ]);

    if (reportsRes.error) {
      // Table may not be applied yet in some envs — continue without reports.
      logServerError("discovery.decorate.reports", reportsRes.error);
    }

    const slugById = new Map(
      (places ?? []).map((p) => [String(p.id), String(p.slug)]),
    );

    const thumbByPlace = new Map<string, string>();
    for (const ph of photos ?? []) {
      const pid = String(ph.place_id);
      if (thumbByPlace.has(pid)) continue;
      if (ph.source_url) thumbByPlace.set(pid, String(ph.source_url));
      else if (ph.storage_path) {
        const { data } = supabase.storage
          .from("place-photos")
          .getPublicUrl(String(ph.storage_path));
        if (data?.publicUrl) thumbByPlace.set(pid, data.publicUrl);
      }
    }

    const countByPlace = new Map<string, number>();
    for (const s of publicSaves ?? []) {
      const pid = String(s.place_id);
      countByPlace.set(pid, (countByPlace.get(pid) ?? 0) + 1);
    }

    const myByPlace = new Map(
      ((mySavesRes as { data?: Array<{ place_id: string; status: string }> }).data ?? []).map(
        (s) => [String(s.place_id), String(s.status)],
      ),
    );

    const dogStatusByPlace = new Map(
      (policies ?? []).map((p) => [String(p.place_id), String(p.dog_status)]),
    );

    const reportsByPlace = new Map<string, PetPolicyReport[]>();
    for (const row of (reportsRes.data ?? []) as ReportRow[]) {
      const pid = String(row.place_id);
      const list = reportsByPlace.get(pid) ?? [];
      list.push(...rowsToReports([row]));
      reportsByPlace.set(pid, list);
    }

    return candidates.map((c) => {
      if (c.provider !== "foursquare") return c;
      const placeId = byExternal.get(c.externalId);
      if (!placeId) return { ...c, policyStatus: c.policyStatus ?? "unknown" };
      const status = myByPlace.get(placeId);
      const publicCount = countByPlace.get(placeId) ?? 0;
      const { policyStatus, overallStatus } = statusForPlace({
        placeId,
        reportsByPlace,
        dogStatusByPlace,
        publicCount,
      });
      return {
        ...c,
        canonicalId: placeId,
        slug: slugById.get(placeId),
        thumbnailUrl: thumbByPlace.get(placeId) ?? c.thumbnailUrl,
        publicContributorCount: publicCount,
        alreadySavedByMe: Boolean(status),
        mySaveStatus:
          status === "been_there" || status === "visited"
            ? "been_there"
            : status
              ? "want_to_go"
              : undefined,
        policyStatus,
        overallStatus,
      };
    });
  } catch (err) {
    logServerError("discovery.decorate", err);
    return candidates;
  }
}
