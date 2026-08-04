import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CollectionDetailClient } from "@/app/collections/[slug]/collection-detail-client";
import {
  getOwnedCollectionBySlug,
  getPlacesForCollection,
} from "@/lib/collections/server";
import { isSupabaseConfigured } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return { title: `${slug.replace(/-/g, " ")} · Collections · Dogmarked` };
}

export default async function CollectionMapPage({ params }: PageProps) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium">Supabase not configured</h1>
        <Link href="/collections" className="mt-4 inline-block text-teal-deep underline">
          Back to collections
        </Link>
      </main>
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/collections/${slug}`);
  }

  const collection = await getOwnedCollectionBySlug(user.id, slug);
  if (!collection) notFound();

  const places = await getPlacesForCollection(collection.placeIds);
  const { data: saves } = await supabase
    .from("user_place_saves")
    .select("place_id, places(id, name, slug)")
    .eq("user_id", user.id);

  const saveOptions = (saves ?? []).flatMap((row) => {
    const placeRaw = row.places as
      | { id: string; name: string; slug: string }
      | { id: string; name: string; slug: string }[]
      | null;
    const place = Array.isArray(placeRaw) ? placeRaw[0] : placeRaw;
    if (!place) return [];
    return [{ placeId: place.id, name: place.name, slug: place.slug }];
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <CollectionDetailClient
      collection={collection}
      places={places.map((p) => ({
        id: String(p.id),
        name: String(p.name),
        slug: String(p.slug),
        city: (p.city as string | null) ?? null,
        category: String(p.category),
      }))}
      saveOptions={saveOptions}
      handle={profile?.handle ?? null}
    />
  );
}
