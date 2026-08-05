import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceDetail } from "@/components/place/place-detail";
import {
  PolicyHistory,
  type PolicyVersionItem,
} from "@/components/policy/policy-history";
import { Button } from "@/components/ui/button";
import type { AffiliateLink } from "@/lib/affiliates";
import {
  mapPlaceLinkRow,
  visiblePlaceLinks,
  type PlaceLink,
  type PlaceLinkRow,
} from "@/lib/place-links";
import { getPlaceBySlug } from "@/lib/places/queries";
import { isSupabaseConfigured } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  return {
    title: place?.name ?? "Place",
  };
}

async function loadAffiliate(placeId: string): Promise<AffiliateLink | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("affiliate_links")
      .select("*")
      .eq("place_id", placeId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: String(data.id),
      placeId: String(data.place_id),
      label: String(data.label ?? "Check availability"),
      url: String(data.url),
      network: (data.network as string | null) ?? null,
      disclosed: Boolean(data.disclosed ?? true),
      isActive: Boolean(data.is_active),
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };
  } catch {
    return null;
  }
}

async function loadPlaceLinks(placeId: string): Promise<PlaceLink[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("place_links")
      .select("*")
      .eq("place_id", placeId)
      .eq("is_active", true)
      .eq("is_verified", true)
      .order("provider", { ascending: true });
    return visiblePlaceLinks(
      (data ?? []).map((row) => mapPlaceLinkRow(row as PlaceLinkRow)),
    );
  } catch {
    return [];
  }
}

async function loadPolicyVersions(placeId: string): Promise<PolicyVersionItem[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("dog_policy_versions")
      .select("*")
      .eq("place_id", placeId)
      .order("snapshot_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((row) => ({
      id: String(row.id),
      dogStatus: String(row.dog_status),
      access: (row.access as string[]) ?? [],
      maxDogs: (row.max_dogs as number | null) ?? null,
      exceptionText: (row.exception_text as string | null) ?? null,
      confidence:
        typeof row.confidence === "number" ? row.confidence : Number(row.confidence ?? null),
      lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
      snapshotAt: String(row.snapshot_at ?? row.created_at ?? new Date().toISOString()),
      promotedFromContributionId:
        (row.promoted_from_contribution_id as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) notFound();

  const [affiliateLink, placeLinks, versions] = await Promise.all([
    loadAffiliate(place.id),
    loadPlaceLinks(place.id),
    loadPolicyVersions(place.id),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 py-8 pb-28">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/explore">← Back to map</Link>
      </Button>
      <PlaceDetail
        place={place}
        affiliateLink={affiliateLink}
        placeLinks={placeLinks}
      />
      <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-deep">
          Policy history
        </h2>
        <p className="mt-1 mb-4 text-xs text-muted">
          Append-only versions. Canonical writes stay server-only.
        </p>
        <PolicyHistory versions={versions} />
      </section>
    </div>
  );
}
