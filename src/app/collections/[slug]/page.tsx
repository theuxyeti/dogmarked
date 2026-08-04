import Link from "next/link";
import {
  getLocalCollectionBySlug,
  southFloridaDemoCollection,
} from "@/lib/collections";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const collection =
    getLocalCollectionBySlug(slug) ??
    (slug === "south-florida-with-dogs" ? southFloridaDemoCollection() : null);
  return {
    title: collection
      ? `${collection.title} · Dogmarked`
      : "Collection · Dogmarked",
  };
}

/**
 * Owner view of a collection map (placeholder until MapLibre wiring).
 */
export default async function CollectionMapPage({ params }: PageProps) {
  const { slug } = await params;
  const collection =
    getLocalCollectionBySlug(slug) ??
    (slug === "south-florida-with-dogs" ? southFloridaDemoCollection() : null);

  if (!collection) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium">Collection not found</h1>
        <Link
          href="/collections"
          className="mt-4 inline-block text-[var(--teal,#0f5c56)] underline"
        >
          Back to collections
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-[var(--ink,#1c2421)]/10 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href="/collections"
          className="text-sm text-[var(--teal,#0f5c56)]"
        >
          ← Collections
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink,#1c2421)]">
          {collection.title}
        </h1>
        {collection.description ? (
          <p className="mt-1 text-sm text-[var(--ink,#1c2421)]/70">
            {collection.description}
          </p>
        ) : null}
      </header>

      <div className="relative flex flex-1 items-center justify-center bg-[linear-gradient(160deg,var(--sand,#e8dfd2)_0%,var(--paper,#f7f4ef)_45%,#cfe3df_100%)]">
        <div className="max-w-sm px-6 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--ink,#1c2421)]">
            Collection map
          </p>
          <p className="mt-2 text-sm text-[var(--ink,#1c2421)]/65">
            MapLibre view for this collection will mount here — same basemap as
            Explore, filtered to {collection.placeIds.length || "saved"} places.
          </p>
          {collection.ownerHandle ? (
            <Link
              href={`/u/${collection.ownerHandle}/${collection.slug}`}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--teal,#0f5c56)] px-5 text-sm font-medium text-white"
            >
              Open public URL
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
