import { redirect } from "next/navigation";

/**
 * Community destination deferred from MVP primary nav.
 * Public discovery is the Community map layer.
 */
export default function CommunityPage() {
  redirect("/explore?community=1");
}
