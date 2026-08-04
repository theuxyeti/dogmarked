import { CommunityClient } from "@/app/community/community-client";
import { listRecentPublicCollections } from "@/lib/collections/server";
import {
  listNeedsVerificationPlaces,
  listRecentlyVerifiedPlaces,
} from "@/lib/places/community";

export const metadata = { title: "Community · Dogmarked" };

export default async function CommunityPage() {
  const [collections, recentlyVerified, needsVerification] = await Promise.all([
    listRecentPublicCollections(12),
    listRecentlyVerifiedPlaces(8),
    listNeedsVerificationPlaces(8),
  ]);

  return (
    <CommunityClient
      collections={collections}
      recentlyVerified={recentlyVerified}
      needsVerification={needsVerification}
    />
  );
}
