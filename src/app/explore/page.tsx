import { ExploreClient } from "@/app/explore/explore-client";
import { DEFAULT_BBOX, getPlacesInBbox } from "@/lib/places/queries";

export const metadata = {
  title: "Explore",
};

export default async function ExplorePage() {
  const places = await getPlacesInBbox(DEFAULT_BBOX);
  return <ExploreClient initialPlaces={places} />;
}
