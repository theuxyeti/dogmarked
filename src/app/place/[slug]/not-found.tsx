import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PlaceNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16 pb-28">
      <h1 className="font-display text-3xl text-teal-deep">Place not found</h1>
      <p className="text-sm text-muted">
        This location isn’t in Dogmarked yet — or it was merged/closed. Map pins
        and basemap POIs are not dog-friendly until someone contributes a
        verified policy.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/explore">Back to Explore</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/add">Add this place</Link>
        </Button>
      </div>
    </div>
  );
}
