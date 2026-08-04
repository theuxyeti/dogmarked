import Link from "next/link";
import { ImportsClient } from "@/app/admin/imports/imports-client";

export const metadata = {
  title: "Imports · Admin · Dogmarked",
  description: "OSM and licensed import administration.",
};

export default function AdminImportsPage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <p className="text-sm text-muted">
          <Link href="/moderate" className="text-teal-deep">
            Moderation
          </Link>
          {" · "}
          <Link href="/admin/merges" className="text-teal-deep">
            Merges
          </Link>
          {" · "}
          <Link href="/admin/claims" className="text-teal-deep">
            Claims
          </Link>
          {" · "}
          <Link href="/admin/partners" className="text-teal-deep">
            Partners
          </Link>
          {" · "}
          Admin
        </p>
        <h1 className="mt-2 font-display text-3xl text-ink">Data imports</h1>
        <p className="mt-2 text-sm text-muted">
          Load Overpass extracts as contribution drafts. Never scrape commercial dog
          directories. Canonical policy updates stay server-only.
        </p>
      </header>

      <ImportsClient />

      <p className="mt-6 text-xs text-muted">
        See scripts/osm-import-south-florida.md for the Overpass query. Confidence for
        OSM imports stays medium and never involves affiliate data.
      </p>
    </main>
  );
}
