import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/utils";

export async function AppHeader() {
  let email: string | null = null;
  let signedIn = false;

  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      signedIn = Boolean(user);
      email = user?.email ?? null;
    } catch {
      signedIn = false;
    }
  }

  return (
    <header className="hidden items-center justify-between gap-4 border-b border-border bg-card/80 px-5 py-3 backdrop-blur md:flex safe-pt">
      <Link href="/explore" className="font-display text-2xl tracking-tight text-teal-deep">
        Dogmarked
      </Link>
      <nav className="flex items-center gap-1 text-sm text-muted">
        <Button asChild variant="ghost" size="sm">
          <Link href="/explore">Explore</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/saved">Saved</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/add">Add</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/community">Community</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/profile">Profile</Link>
        </Button>
        {signedIn ? (
          <>
            <span className="hidden max-w-[10rem] truncate px-2 text-xs text-muted lg:inline">
              {email}
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/auth/signout">Sign out</Link>
            </Button>
          </>
        ) : (
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </nav>
    </header>
  );
}
