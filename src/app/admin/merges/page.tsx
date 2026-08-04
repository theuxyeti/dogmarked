import Link from "next/link";
import { MergesClient } from "@/app/admin/merges/merges-client";

export const metadata = {
  title: "Merges · Admin · Dogmarked",
  description: "Merge duplicate places without collapsing personal saves into public policy.",
};

export default function AdminMergesPage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <p className="text-sm text-muted">
          <Link href="/moderate" className="text-teal-deep">
            Moderation
          </Link>
          {" · "}
          <Link href="/admin/imports" className="text-teal-deep">
            Imports
          </Link>
          {" · "}
          <Link href="/admin/partners" className="text-teal-deep">
            Partners
          </Link>
          {" · "}
          Admin
        </p>
        <h1 className="mt-2 font-display text-3xl text-ink">Duplicate merges</h1>
        <p className="mt-2 text-sm text-muted">
          Reparent saves, contributions, and evidence onto the survivor. Canonical policy stays
          server-owned on the survivor place.
        </p>
      </header>

      <MergesClient />
    </main>
  );
}
