import { Suspense } from "react";
import { ExploreClient } from "@/app/explore/explore-client";

export const metadata = {
  title: "Map",
  description: "Find a place, save it, and see it on your Dogmarked map.",
};

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[50dvh] items-center justify-center text-sm text-[var(--color-text-muted)]">
          Loading map…
        </div>
      }
    >
      <ExploreClient />
    </Suspense>
  );
}
