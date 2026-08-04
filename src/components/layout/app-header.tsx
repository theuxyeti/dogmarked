import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserAvatarMenu } from "@/components/layout/user-avatar-menu";

export async function AppHeader() {
  return (
    <>
      {/* Desktop / large tablet landscape */}
      <header className="hidden h-16 items-center justify-between gap-4 border-b border-border bg-card/90 px-5 backdrop-blur xl:flex safe-pt">
        <Link
          href="/explore"
          className="font-display text-2xl tracking-tight text-teal-deep"
        >
          Dogmarked
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted">
          <Button asChild variant="ghost" size="sm">
            <Link href="/explore">Explore</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/saved">My Places</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/community">Community</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/add">Add place</Link>
          </Button>
          <UserAvatarMenu />
        </nav>
      </header>

      {/* Phone / tablet: brand bar; primary nav is the bottom bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur xl:hidden safe-pt">
        <Link
          href="/explore"
          className="font-display text-xl tracking-tight text-teal-deep"
        >
          Dogmarked
        </Link>
        <UserAvatarMenu />
      </header>
    </>
  );
}
