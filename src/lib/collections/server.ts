import type { Collection, CollectionVisibility } from "@/lib/collections";
import { isSupabaseConfigured } from "@/lib/utils";

type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  owner_id: string;
  visibility: CollectionVisibility;
  cover_place_id: string | null;
  created_at: string;
  updated_at: string;
  collection_places?: Array<{ place_id: string }> | null;
};

function mapCollection(row: CollectionRow, ownerHandle: string | null = null): Collection {
  const placeIds = (row.collection_places ?? []).map((p) => p.place_id);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    ownerId: row.owner_id,
    ownerHandle,
    visibility: row.visibility,
    placeIds,
    coverPlaceId: row.cover_place_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `
  id, slug, title, description, owner_id, visibility, cover_place_id, created_at, updated_at,
  collection_places(place_id)
`;

async function handleForUser(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("handle").eq("id", userId).maybeSingle();
  return data?.handle ?? null;
}

export async function listOwnedCollections(userId: string): Promise<Collection[]> {
  if (!isSupabaseConfigured()) return [];
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(SELECT)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  const handle = await handleForUser(supabase, userId);
  return (data as unknown as CollectionRow[]).map((row) => mapCollection(row, handle));
}

export async function getOwnedCollectionBySlug(
  userId: string,
  slug: string,
): Promise<Collection | null> {
  if (!isSupabaseConfigured()) return null;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(SELECT)
    .eq("owner_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const handle = await handleForUser(supabase, userId);
  return mapCollection(data as unknown as CollectionRow, handle);
}

export async function getSharedCollectionByHandleSlug(
  handle: string,
  slug: string,
): Promise<Collection | null> {
  if (!isSupabaseConfigured()) return null;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle")
    .ilike("handle", handle)
    .maybeSingle();

  if (!profile) return null;

  const { data, error } = await supabase
    .from("collections")
    .select(SELECT)
    .eq("owner_id", profile.id)
    .eq("slug", slug)
    .in("visibility", ["public", "link"])
    .maybeSingle();

  if (error || !data) return null;
  return mapCollection(data as unknown as CollectionRow, profile.handle);
}

/** Recent public collections across all users (Community tab). */
export async function listRecentPublicCollections(limit = 12): Promise<Collection[]> {
  if (!isSupabaseConfigured()) return [];
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(SELECT)
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const rows = data as unknown as CollectionRow[];
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, handle")
    .in("id", ownerIds);
  const handleById = new Map(
    (profiles ?? []).map((p) => [String(p.id), (p.handle as string | null) ?? null]),
  );
  return rows.map((row) => mapCollection(row, handleById.get(row.owner_id) ?? null));
}

export async function listPublicCollectionsForHandle(handle: string): Promise<Collection[]> {
  if (!isSupabaseConfigured()) return [];
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle")
    .ilike("handle", handle)
    .maybeSingle();
  if (!profile) return [];

  const { data, error } = await supabase
    .from("collections")
    .select(SELECT)
    .eq("owner_id", profile.id)
    .eq("visibility", "public")
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as CollectionRow[]).map((row) =>
    mapCollection(row, profile.handle),
  );
}

export async function getPlacesForCollection(placeIds: string[]) {
  if (!placeIds.length || !isSupabaseConfigured()) return [];
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("places")
    .select("id, name, slug, city, category, lat, lng")
    .in("id", placeIds)
    .eq("status", "active");
  return data ?? [];
}
