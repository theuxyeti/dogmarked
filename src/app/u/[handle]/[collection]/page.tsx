import Link from "next/link";
import {
  fetchPublicCollection,
  southFloridaDemoCollection,
} from "@/lib/collections";

interface PageProps {
  params: Promise<{ handle: string; collection: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { handle, collection: slug } = await params;
  const title =
    handle === "zach" && slug === "south-florida-with-dogs"
      ? "South Florida with dogs"
      : slug.replace(/-/g, " ");
  return {
    title: `${title} · @${handle} · Dogmarked`,
    description: `Public Dogmarked collection by @${handle}`,
  };
}

/**
 * Public collection URL: `/u/zach/south-florida-with-dogs`
 */
export default async function PublicCollectionPage({ params }: PageProps) {
  const { handle, collection: slug } = await params;
  let collection = await fetchPublicCollection(handle, slug);

  if (
    !collection &&
    handle === "zach" &&
    slug === "south-florida-with-dogs"
  ) {
    collection = southFloridaDemoCollection();
  }

  if (!collection) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium">Map not found</h1>
        <p className="mt-2 text-sm text-[var(--ink,#1c2421)]/65">
          This collection is private or does not exist.
        </p>
        <Link
          href="/explore"
          className="mt-4 inline-block text-[var(--teal,#0f5c56)] underline"
        >
          Explore Dogmarked
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[var(--paper,#f7f4ef)]">
      <header className="px-4 py-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink,#1c2421)]">
          Dogmarked
        </p>
        <p className="mt-3 text-sm text-[var(--ink,#1c2421)]/60">
          <Link
            href={`/u/${handle}`}
            className="text-[var(--teal,#0f5c56)] hover:underline"
          >
            @{handle}
          </Link>
          {" · "}
          shared map
        </p>
        <h1 className="mt-1 text-2xl font-medium text-[var(--ink,#1c2421)]">
          {collection.title}
        </h1>
        {collection.description ? (
          <p className="mt-2 max-w-xl text-sm text-[var(--ink,#1c2421)]/70">
            {collection.description}
          </p>
        ) : null}
      </header>

      <section className="mx-4 mb-8 flex flex-1 flex-col overflow-hidden rounded-3xl bg-[linear-gradient(145deg,#d9ebe7,var(--sand,#e8dfd2))] ring-1 ring-[var(--ink,#1c2421)]/8">
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal,#0f5c56)]">
            Public collection
          </p>
          <p className="mt-3 max-w-sm text-sm text-[var(--ink,#1c2421)]/70">
            Interactive map placeholder. Followers will see pins from this
            collection without accessing private notes.
          </p>
          <Link
            href="/explore"
            className="mt-8 inline-flex min-h-11 items-center rounded-full bg-[var(--ink,#1c2421)] px-5 text-sm font-medium text-[var(--paper,#f7f4ef)]"
          >
            Open Explore
          </Link>
        </div>
      </section>
    </main>
  );
}
