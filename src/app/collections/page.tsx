import { CollectionsClient } from "@/app/collections/collections-client";
import { listOwnedCollections } from "@/lib/collections/server";
import { isSupabaseConfigured } from "@/lib/utils";

export const metadata = {
  title: "Collections · Dogmarked",
  description: "Your personal maps of dog-friendly places.",
};

export default async function CollectionsPage() {
  let collections: Awaited<ReturnType<typeof listOwnedCollections>> = [];
  let signedIn = false;
  let handle: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        signedIn = true;
        collections = await listOwnedCollections(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("handle")
          .eq("id", user.id)
          .maybeSingle();
        handle = profile?.handle ?? null;
      }
    } catch {
      // leave empty
    }
  }

  return (
    <CollectionsClient
      initialCollections={collections}
      signedIn={signedIn}
      handle={handle}
    />
  );
}
