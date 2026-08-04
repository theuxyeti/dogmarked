import { isSupabaseConfigured } from "@/lib/utils";

export type CommunityPlaceChip = {
  slug: string;
  name: string;
  meta: string;
};

function formatVerified(iso: string | null): string {
  if (!iso) return "Unverified";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export async function listRecentlyVerifiedPlaces(limit = 8): Promise<CommunityPlaceChip[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dog_policies")
      .select("last_verified_at, source_type, places!inner(name, slug, status, city)")
      .not("last_verified_at", "is", null)
      .eq("places.status", "active")
      .order("last_verified_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.flatMap((row) => {
      const placeRaw = row.places as
        | { name: string; slug: string; city: string | null }
        | { name: string; slug: string; city: string | null }[]
        | null;
      const place = Array.isArray(placeRaw) ? placeRaw[0] : placeRaw;
      if (!place) return [];
      return [
        {
          slug: place.slug,
          name: place.name,
          meta: `Verified ${formatVerified(row.last_verified_at as string | null)} · ${row.source_type ?? "community"}`,
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function listNeedsVerificationPlaces(limit = 8): Promise<CommunityPlaceChip[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("places")
      .select("name, slug, city, dog_policies(last_verified_at, confidence)")
      .eq("status", "active")
      .limit(40);

    if (error || !data) return [];

    const staleCutoff = Date.now() - 1000 * 60 * 60 * 24 * 365;

    return data
      .map((row) => {
        const policyRaw = row.dog_policies as
          | { last_verified_at: string | null; confidence: number | null }
          | { last_verified_at: string | null; confidence: number | null }[]
          | null;
        const policy = Array.isArray(policyRaw) ? policyRaw[0] : policyRaw;
        const verifiedAt = policy?.last_verified_at ?? null;
        const ts = verifiedAt ? Date.parse(verifiedAt) : NaN;
        const needs =
          !verifiedAt ||
          Number.isNaN(ts) ||
          ts < staleCutoff ||
          (typeof policy?.confidence === "number" && policy.confidence < 0.45);
        if (!needs) return null;
        return {
          slug: String(row.slug),
          name: String(row.name),
          meta: !verifiedAt
            ? "Never verified"
            : `Last verified ${formatVerified(verifiedAt)}${row.city ? ` · ${row.city}` : ""}`,
        } satisfies CommunityPlaceChip;
      })
      .filter((x): x is CommunityPlaceChip => Boolean(x))
      .slice(0, limit);
  } catch {
    return [];
  }
}
