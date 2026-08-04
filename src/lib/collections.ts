/**
 * Collections — personal/shared maps of places (Phase 3).
 * localStorage fallback for offline/dev; Supabase helpers are stubs until RLS tables land.
 */

export type CollectionVisibility = "private" | "link" | "public";

export interface Collection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  ownerId: string;
  ownerHandle: string | null;
  visibility: CollectionVisibility;
  placeIds: string[];
  coverPlaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionPlaceRef {
  collectionId: string;
  placeId: string;
  note: string | null;
  sortOrder: number;
  addedAt: string;
}

const STORAGE_KEY = "dogmarked.collections.v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readLocal(): Collection[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Collection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(collections: Collection[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
}

export function slugifyCollectionTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "collection";
}

export function listLocalCollections(ownerId?: string): Collection[] {
  const all = readLocal();
  return ownerId ? all.filter((c) => c.ownerId === ownerId) : all;
}

export function getLocalCollectionBySlug(
  slug: string,
  ownerId?: string,
): Collection | null {
  return (
    listLocalCollections(ownerId).find((c) => c.slug === slug) ?? null
  );
}

export function upsertLocalCollection(
  input: Omit<Collection, "createdAt" | "updatedAt"> & {
    createdAt?: string;
    updatedAt?: string;
  },
): Collection {
  const now = new Date().toISOString();
  const existing = readLocal();
  const idx = existing.findIndex((c) => c.id === input.id);
  const row: Collection = {
    ...input,
    createdAt: input.createdAt ?? existing[idx]?.createdAt ?? now,
    updatedAt: now,
  };
  if (idx >= 0) existing[idx] = row;
  else existing.push(row);
  writeLocal(existing);
  return row;
}

export function deleteLocalCollection(id: string): void {
  writeLocal(readLocal().filter((c) => c.id !== id));
}

export function publicCollectionPath(
  handle: string,
  collectionSlug: string,
): string {
  return `/u/${encodeURIComponent(handle)}/${encodeURIComponent(collectionSlug)}`;
}

/** Stub: fetch collections for current user from Supabase when wired. */
export async function fetchUserCollections(_userId: string): Promise<Collection[]> {
  // TODO: supabase.from('collections').select(...).eq('owner_id', userId)
  return listLocalCollections(_userId);
}

/** Stub: fetch a public/link collection by handle + slug. */
export async function fetchPublicCollection(
  handle: string,
  collectionSlug: string,
): Promise<Collection | null> {
  // TODO: join profiles.handle + collections.slug with visibility filter
  const local = listLocalCollections().find(
    (c) =>
      c.ownerHandle === handle &&
      c.slug === collectionSlug &&
      (c.visibility === "public" || c.visibility === "link"),
  );
  return local ?? null;
}

/** Demo fixture for South Florida curated map UI. */
export function southFloridaDemoCollection(): Collection {
  const now = new Date().toISOString();
  return {
    id: "demo-south-florida-with-dogs",
    slug: "south-florida-with-dogs",
    title: "South Florida with dogs",
    description: "Parks, beaches, and patios worth the leash walk.",
    ownerId: "demo-user",
    ownerHandle: "zach",
    visibility: "public",
    placeIds: [],
    coverPlaceId: null,
    createdAt: now,
    updatedAt: now,
  };
}
