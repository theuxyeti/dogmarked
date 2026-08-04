import Link from "next/link";

export const metadata = {
  title: "Imports · Admin · Dogmarked",
  description: "OSM and licensed import administration stub.",
};

/**
 * Import admin stub — review OSM drafts before promote.
 * See scripts/osm-import-south-florida.md
 */
export default function AdminImportsPage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <p className="text-sm text-[var(--ink,#1c2421)]/55">
          <Link href="/moderate" className="text-[var(--teal,#0f5c56)]">
            Moderation
          </Link>
          {" · "}
          Admin
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--ink,#1c2421)]">
          Data imports
        </h1>
        <p className="mt-2 text-sm text-[var(--ink,#1c2421)]/65">
          Load Overpass extracts as contribution drafts. Never scrape commercial
          dog directories. Canonical policy updates stay server-only.
        </p>
      </header>

      <section className="rounded-2xl bg-[var(--sand,#e8dfd2)]/40 px-4 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]">
          South Florida OSM
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--ink,#1c2421)]/80">
          <li>Follow the Overpass runbook in scripts/osm-import-south-florida.md</li>
          <li>Map tags with src/lib/imports/osm-mapper.ts</li>
          <li>Insert places + draft contributions with OSM provenance</li>
          <li>Promote via supabase/functions/promote-policy (or RPC)</li>
        </ol>
        <button
          type="button"
          disabled
          className="mt-6 min-h-11 rounded-full bg-[var(--ink,#1c2421)] px-5 text-sm font-medium text-[var(--paper,#f7f4ef)] opacity-45"
          title="Upload wiring comes after storage bucket + admin RLS"
        >
          Upload Overpass JSON (soon)
        </button>
      </section>

      <p className="mt-6 text-xs text-[var(--ink,#1c2421)]/50">
        Confidence for OSM imports stays medium and never involves affiliate
        data.
      </p>
    </main>
  );
}
