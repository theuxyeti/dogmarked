import Link from "next/link";
import { ClaimsClient } from "@/app/admin/claims/claims-client";

export const metadata = {
  title: "Claims · Admin · Dogmarked",
  description: "Review business ownership claims. Does not grant policy write access.",
};

export default function AdminClaimsPage() {
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
          <Link href="/admin/imports" className="text-teal-deep">
            Imports
          </Link>
          {" · "}
          Admin
        </p>
        <h1 className="mt-2 font-display text-3xl text-ink">Business claims</h1>
        <p className="mt-2 text-sm text-muted">
          Stub review queue. Approving a claim never auto-promotes dog policy or bypasses
          server-only canonical writes.
        </p>
      </header>

      <ClaimsClient />
    </main>
  );
}
