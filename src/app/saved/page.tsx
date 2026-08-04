import { redirect } from "next/navigation";

/** My Places lives on the map List view. */
export default function SavedPage() {
  redirect("/explore");
}
