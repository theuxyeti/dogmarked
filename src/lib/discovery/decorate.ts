import type { PlaceCandidate } from "@/lib/discovery/types";
import { logServerError } from "@/lib/api-errors";

export type DecoratedCandidate = PlaceCandidate;

/**
 * One batched Dogmarked lookup for nearby FSQ candidates.
 * No N+1 queries.
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

    const [{ data: places }, { data: photos }, { data: publicSaves }, mySavesRes] =
      await Promise.all([
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
      ]);

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

    return candidates.map((c) => {
      if (c.provider !== "foursquare") return c;
      const placeId = byExternal.get(c.externalId);
      if (!placeId) return c;
      const status = myByPlace.get(placeId);
      return {
        ...c,
        canonicalId: placeId,
        slug: slugById.get(placeId),
        thumbnailUrl: thumbByPlace.get(placeId) ?? c.thumbnailUrl,
        publicContributorCount: countByPlace.get(placeId) ?? 0,
        alreadySavedByMe: Boolean(status),
        mySaveStatus:
          status === "been_there" || status === "visited"
            ? "been_there"
            : status
              ? "want_to_go"
              : undefined,
      };
    });
  } catch (err) {
    logServerError("discovery.decorate", err);
    return candidates;
  }
}
