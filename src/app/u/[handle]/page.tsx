import Link from "next/link";
import { FollowButton } from "@/components/profile/follow-button";
import { listPublicCollectionsForHandle } from "@/lib/collections/server";
import { isSupabaseConfigured } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return { title: `@${handle} · Dogmarked` };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  let profileId: string | null = null;
  let displayName: string | null = null;
  let collections: Awaited<ReturnType<typeof listPublicCollectionsForHandle>> = [];
  let publicSaves: Array<{
    place_id: string;
    status: string;
    place_name: string;
    place_slug: string;
    city: string | null;
    category: string;
  }> = [];
  let contributions: Array<{
    contribution_id: string;
    place_id: string;
    place_name: string;
    place_slug: string;
    dog_status: string;
    observed_at: string | null;
    created_at: string;
  }> = [];

  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { data: profileRows } = await supabase.rpc("get_profile_by_handle", {
        p_handle: handle,
      });
      const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
      if (profile) {
        profileId = String(profile.id);
        displayName = (profile.display_name as string | null) ?? null;
      }

      collections = await listPublicCollectionsForHandle(handle);

      const { data: saves } = await supabase.rpc("list_public_saves_for_handle", {
        p_handle: handle,
      });
      publicSaves = (saves as typeof publicSaves) ?? [];

      const { data: contribs } = await supabase.rpc(
        "list_public_contributions_for_handle",
        { p_handle: handle },
      );
      contributions = (contribs as typeof contributions) ?? [];
    } catch {
      // RPC may not be applied yet on hosted DB
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-28">
      <p className="font-display text-2xl text-teal-deep">Dogmarked</p>
      <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted">Public profile</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-ink">@{handle}</h1>
          {displayName ? <p className="mt-1 text-muted">{displayName}</p> : null}
        </div>
        {profileId ? <FollowButton targetType="user" targetId={profileId} /> : null}
      </div>
      <p className="mt-3 text-sm text-muted">
        Public collections, saves, and published contributions. Private notes stay private.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-deep">
          Public collections
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {collections.map((c) => (
            <li key={c.id}>
              <Link
                href={`/u/${handle}/${c.slug}`}
                className="block rounded-xl border border-border bg-card/70 px-4 py-3"
              >
                <span className="font-medium text-ink">{c.title}</span>
                {c.description ? (
                  <span className="mt-1 block text-sm text-muted">{c.description}</span>
                ) : null}
                <span className="mt-1 block text-xs text-muted">
                  {c.placeIds.length} places
                </span>
              </Link>
            </li>
          ))}
          {collections.length === 0 ? (
            <li className="text-sm text-muted">No public collections yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-deep">
          Public saves
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {publicSaves.map((s) => (
            <li key={s.place_id}>
              <Link
                href={`/place/${s.place_slug}`}
                className="block rounded-xl px-3 py-2 hover:bg-foam"
              >
                <span className="font-medium text-ink">{s.place_name}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {s.status.replaceAll("_", " ")}
                  {s.city ? ` · ${s.city}` : ""}
                </span>
              </Link>
            </li>
          ))}
          {publicSaves.length === 0 ? (
            <li className="text-sm text-muted">No public saves yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-deep">
          Contribution history
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {contributions.map((c) => (
            <li key={c.contribution_id}>
              <Link
                href={`/place/${c.place_slug}`}
                className="block rounded-xl px-3 py-2 hover:bg-foam"
              >
                <span className="font-medium text-ink">{c.place_name}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {c.dog_status.replaceAll("_", " ")}
                  {c.observed_at ? ` · observed ${c.observed_at}` : ""}
                </span>
              </Link>
            </li>
          ))}
          {contributions.length === 0 ? (
            <li className="text-sm text-muted">
              No published contributions yet
              {!isSupabaseConfigured() ? "." : " (apply seasonal migration if expected)."}
            </li>
          ) : null}
        </ul>
      </section>

      <p className="mt-10 text-sm text-muted">
        <Link href="/explore" className="text-teal-deep underline">
          Explore the map
        </Link>
      </p>
    </div>
  );
}
