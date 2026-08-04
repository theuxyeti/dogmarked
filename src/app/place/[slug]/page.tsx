import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceDetail } from "@/components/place/place-detail";
import { Button } from "@/components/ui/button";
import { getPlaceBySlug } from "@/lib/places/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  return {
    title: place?.name ?? "Place",
  };
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-8 pb-28">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/explore">← Back to map</Link>
      </Button>
      <PlaceDetail place={place} />
    </div>
  );
}
