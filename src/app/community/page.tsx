import { redirect } from "next/navigation";

/**
 * Community destination deferred from MVP.
 * Public discovery is the “Other people” map overlay.
 */
export default function CommunityPage() {
  redirect("/explore?overlay=others");
}
