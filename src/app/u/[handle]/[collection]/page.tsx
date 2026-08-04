import Link from "next/link";
import {
  getPlacesForCollection,
  getSharedCollectionByHandleSlug,
} from "@/lib/collections/server";
import { isSupabaseConfigured } from "@/lib/utils";

interface PageProps {
  params: Promise<{ handle: string; collection: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { handle, collection: slug } = await params;
  return {
    title: `${slug.replace(/-/g, " ")} · @${handle} · Dogmarked`,
    description: `Shared Dogmarked collection by @${handle}`,
  };
}

export default async function PublicCollectionPage({ params }: PageProps) {
  const { handle, collection: slug } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium">Map unavailable</h1>
        <Link href="/explore" className="mt-4 inline-block text-teal-deep underline">
          Explore Dogmarked
        </Link>
      </main>
    );
  }

  const collection = await getSharedCollectionByHandleSlug(handle, slug);

  if (!collection) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium">Map not found</h1>
        <p className="mt-2 text-sm text-muted">
          This collection is private or does not exist.
        </p>
        <Link href="/explore" className="mt-4 inline-block text-teal-deep underline">
          Explore Dogmarked
        </Link>
      </main>
    );
  }

  const places = await getPlacesForCollection(collection.placeIds);

  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <p className="font-display text-2xl text-teal-deep">Dogmarked</p>
      <p className="mt-3 text-sm text-muted">
        <Link href={`/u/${handle}`} className="text-teal-deep hover:underline">
          @{handle}
        </Link>
        {" · "}
        shared map
      </p>
      <h1 className="mt-1 font-display text-3xl text-ink">{collection.title}</h1>
      {collection.description ? (
        <p className="mt-2 max-w-xl text-sm text-muted">{collection.description}</p>
      ) : null}

      <ul className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
        {places.map((place) => (
          <li key={String(place.id)}>
            <Link
              href={`/place/${place.slug}`}
              className="flex min-h-11 items-center justify-between px-4 py-3"
            >
              <span>
                <span className="font-medium text-ink">{String(place.name)}</span>
                {place.city ? (
                  <span className="mt-0.5 block text-xs text-muted">
                    {String(place.city)} · {String(place.category)}
                  </span>
                ) : null}
              </span>
              <span className="text-muted">→</span>
            </Link>
          </li>
        ))}
        {places.length === 0 ? (
          <li className="px-4 py-8 text-sm text-muted">No places in this shared map yet.</li>
        ) : null}
      </ul>

      <Link
        href="/explore"
        className="mt-8 inline-flex min-h-11 items-center text-sm text-teal-deep underline"
      >
        Open Explore
      </Link>
    </main>
  );
}
