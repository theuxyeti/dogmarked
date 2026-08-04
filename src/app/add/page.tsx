import { Suspense } from "react";
import AddClient from "@/app/add/add-client";

export const metadata = { title: "Add a place" };

export default function AddPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-10 text-sm text-muted">Loading add form…</div>
      }
    >
      <AddClient />
    </Suspense>
  );
}
