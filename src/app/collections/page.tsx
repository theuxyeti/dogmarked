import Link from "next/link";
import { southFloridaDemoCollection } from "@/lib/collections";

export const metadata = {
  title: "Collections · Dogmarked",
  description: "Your personal maps of dog-friendly places.",
};

/**
 * List the signed-in user's collections.
 * Uses a demo fixture until auth + Supabase collections are wired.
 */
export default function CollectionsPage() {
  const demo = southFloridaDemoCollection();
  const collections = [demo];

  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink,#1c2421)]">
          Dogmarked
        </p>
        <h1 className="mt-2 text-xl font-medium text-[var(--ink,#1c2421)]">
          Collections
        </h1>
        <p className="mt-1 text-sm text-[var(--ink,#1c2421)]/70">
          Trip maps and shared lists. Saving privately never publishes policy.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {collections.map((c) => (
          <li key={c.id}>
            <Link
              href={`/collections/${c.slug}`}
              className="block rounded-2xl bg-[var(--sand,#e8dfd2)]/40 px-4 py-4 transition hover:bg-[var(--sand,#e8dfd2)]/70"
            >
              <span className="font-medium text-[var(--ink,#1c2421)]">
                {c.title}
              </span>
              {c.description ? (
                <p className="mt-1 text-sm text-[var(--ink,#1c2421)]/65">
                  {c.description}
                </p>
              ) : null}
              <p className="mt-2 text-xs uppercase tracking-wide text-[var(--teal,#0f5c56)]">
                {c.visibility} · {c.placeIds.length} places
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-[var(--ink,#1c2421)]/55">
        Public share URLs look like{" "}
        <code className="rounded bg-[var(--sand,#e8dfd2)]/50 px-1.5 py-0.5 text-xs">
          /u/zach/south-florida-with-dogs
        </code>
        .
      </p>
    </main>
  );
}
