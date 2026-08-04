import Link from "next/link";
import { PartnersClient } from "@/app/admin/partners/partners-client";

export const metadata = {
  title: "Partners · Admin · Dogmarked",
  description: "Affiliate click reporting for booking partners.",
};

export default function AdminPartnersPage() {
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
          <Link href="/admin/merges" className="text-teal-deep">
            Merges
          </Link>
          {" · "}
          <Link href="/admin/claims" className="text-teal-deep">
            Claims
          </Link>
          {" · "}
          Admin
        </p>
        <h1 className="mt-2 font-display text-3xl text-ink">Partner reporting</h1>
        <p className="mt-2 text-sm text-muted">
          Clicks from disclosed booking CTAs. Affiliate data never changes policy
          confidence or match scoring.
        </p>
      </header>

      <PartnersClient />
    </main>
  );
}
