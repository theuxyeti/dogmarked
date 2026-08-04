import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SavedLibrary } from "@/components/saved/saved-library";

export const metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <div>
      <SavedLibrary title="Your personal map" />
      <div className="mx-auto flex max-w-2xl flex-wrap gap-2 px-4 pb-28">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/explore">Explore map</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/collections">Collections</Link>
        </Button>
      </div>
    </div>
  );
}
