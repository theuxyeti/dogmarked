/**
 * Follow graph stubs — users and collections (Phase 6).
 */

export type FollowTargetType = "user" | "collection";

export interface Follow {
  id: string;
  followerId: string;
  targetType: FollowTargetType;
  /** profiles.id when targetType=user; collections.id when collection */
  targetId: string;
  createdAt: string;
}

export interface FollowUserSummary {
  id: string;
  handle: string;
  displayName: string | null;
}

export interface FollowCollectionSummary {
  id: string;
  slug: string;
  title: string;
  ownerHandle: string;
}

const STORAGE_KEY = "dogmarked.follows.v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readStore(): Follow[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Follow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(rows: Follow[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listFollows(followerId: string): Follow[] {
  return readStore().filter((f) => f.followerId === followerId);
}

export function isFollowing(
  followerId: string,
  targetType: FollowTargetType,
  targetId: string,
): boolean {
  return readStore().some(
    (f) =>
      f.followerId === followerId &&
      f.targetType === targetType &&
      f.targetId === targetId,
  );
}

export function followTarget(
  followerId: string,
  targetType: FollowTargetType,
  targetId: string,
): Follow {
  const existing = readStore();
  const found = existing.find(
    (f) =>
      f.followerId === followerId &&
      f.targetType === targetType &&
      f.targetId === targetId,
  );
  if (found) return found;

  const row: Follow = {
    id: `follow-${crypto.randomUUID?.() ?? String(Date.now())}`,
    followerId,
    targetType,
    targetId,
    createdAt: new Date().toISOString(),
  };
  existing.push(row);
  writeStore(existing);
  return row;
}

export function unfollowTarget(
  followerId: string,
  targetType: FollowTargetType,
  targetId: string,
): void {
  writeStore(
    readStore().filter(
      (f) =>
        !(
          f.followerId === followerId &&
          f.targetType === targetType &&
          f.targetId === targetId
        ),
    ),
  );
}

/** Stub: remote follow sync when Supabase `follows` table is available. */
export async function syncFollowsFromServer(
  _followerId: string,
): Promise<Follow[]> {
  // TODO: supabase.from('follows').select('*').eq('follower_id', followerId)
  return listFollows(_followerId);
}
