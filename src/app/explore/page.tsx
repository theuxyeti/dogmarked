import { ExploreClient } from "@/app/explore/explore-client";
import { DEFAULT_BBOX, getPlacesInBbox } from "@/lib/places/queries";
import { parseExploreUrlState } from "@/lib/url-state";

export const metadata = {
  title: "Explore",
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialState = parseExploreUrlState(params);

  const pad = 0.35;
  const places = await getPlacesInBbox({
    minLng: initialState.lng - pad,
    minLat: initialState.lat - pad,
    maxLng: initialState.lng + pad,
    maxLat: initialState.lat + pad,
  }).catch(() => getPlacesInBbox(DEFAULT_BBOX));

  return <ExploreClient initialPlaces={places} initialState={initialState} />;
}
