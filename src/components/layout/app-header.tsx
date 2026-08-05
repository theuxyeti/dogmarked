"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { LayersControl } from "@/components/layout/layers-control";
import { UserAvatarMenu } from "@/components/layout/user-avatar-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";

/**
 * Map-first Explore header: wordmark, search, compact Layers, pack avatar.
 */
export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const showMine = searchParams.get("mine") !== "0";
  const showCommunity = searchParams.get("community") === "1";
  const showDiscover = searchParams.get("discover") !== "0";

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  function patchLayers(next: {
    mine?: boolean;
    community?: boolean;
    discover?: boolean;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const mine = next.mine ?? showMine;
    const community = next.community ?? showCommunity;
    const discover = next.discover ?? showDiscover;
    if (mine) params.delete("mine");
    else params.set("mine", "0");
    if (community) params.set("community", "1");
    else params.delete("community");
    if (discover) params.delete("discover");
    else params.set("discover", "0");
    params.delete("overlay");
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);

    void fetch("/api/map-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showMyPlaces: mine, showCommunity: community }),
    }).catch(() => {
      /* guests keep URL state */
    });
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", q);
    router.push(`/explore?${params.toString()}`);
  }

  function clearSearch() {
    setQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      // Explore owns suggestions; clear query focus only here.
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <header
      className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5 safe-pt"
      style={{
        background: "color-mix(in oklab, var(--color-surface) 92%, transparent)",
        borderBottom: "1px solid var(--color-border)",
        backdropFilter: "blur(10px)",
      }}
    >
      <Link
        href="/explore"
        className="shrink-0 font-display text-xl tracking-tight text-[var(--color-brand)] sm:text-2xl focus-visible:rounded-lg"
      >
        Dogmarked
      </Link>

      <form onSubmit={onSearchSubmit} className="relative min-w-0 flex-1 max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search places or addresses…"
          className="h-10 min-h-10 rounded-xl border-[var(--color-border)] bg-[var(--color-surface-raised)] pl-9 pr-10 text-sm shadow-[var(--elevation-1)] sm:h-11 sm:min-h-11"
          aria-label="Search places"
          autoComplete="off"
        />
        {query.trim() ? (
          <IconButton
            type="button"
            onClick={clearSearch}
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </IconButton>
        ) : null}
      </form>

      {pathname.startsWith("/explore") ? (
        <LayersControl
          showMine={showMine}
          showCommunity={showCommunity}
          showDiscover={showDiscover}
          onChange={patchLayers}
        />
      ) : null}

      <UserAvatarMenu />
    </header>
  );
}
