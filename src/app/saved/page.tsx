import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SavedLibrary, type SavedLibraryItem } from "@/components/saved/saved-library";
import { isSupabaseConfigured } from "@/lib/utils";

export const metadata = { title: "My Places" };

async function loadSaves(): Promise<{
  items: SavedLibraryItem[];
  signedIn: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return {
      items: [],
      signedIn: false,
      error: "Supabase is not configured yet.",
    };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { items: [], signedIn: false, error: null };
    }

    const { data, error } = await supabase
      .from("user_place_saves")
      .select(
        "place_id, status, visibility, places(id, name, slug, city, category)",
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return { items: [], signedIn: true, error: error.message };
    }

    const items: SavedLibraryItem[] = (data ?? []).flatMap((row) => {
      const placeRaw = row.places as
        | { id: string; name: string; slug: string; city: string | null; category: string | null }
        | { id: string; name: string; slug: string; city: string | null; category: string | null }[]
        | null;
      const place = Array.isArray(placeRaw) ? placeRaw[0] : placeRaw;
      if (!place) return [];
      return [
        {
          placeId: place.id,
          slug: place.slug,
          name: place.name,
          status: row.status as SavedLibraryItem["status"],
          visibility: row.visibility as SavedLibraryItem["visibility"],
          city: place.city,
          category: place.category,
        },
      ];
    });

    return { items, signedIn: true, error: null };
  } catch (err) {
    return {
      items: [],
      signedIn: false,
      error: err instanceof Error ? err.message : "Could not load saves.",
    };
  }
}

export default async function SavedPage() {
  const { items, signedIn, error } = await loadSaves();

  return (
    <div>
      <SavedLibrary title="My Places" items={items} />
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pb-28">
        {error ? (
          <p className="text-sm text-danger">
            Could not load your places. Sign in again or try later.
          </p>
        ) : null}
        {!signedIn ? (
          <p className="text-sm text-muted">
            Sign in to load your private saves. Saving never publishes a dog policy.
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            No saves yet. Open a place on Explore and choose <strong>Save privately</strong>.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!signedIn ? (
            <Button asChild>
              <Link href="/login?next=/saved">Sign in</Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href="/explore">Explore map</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/add">Add a place</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
