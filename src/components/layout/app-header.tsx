"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { UserAvatarMenu } from "@/components/layout/user-avatar-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Map-first Explore header: wordmark, search, restrained layer control, account.
 */
export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const showMine = searchParams.get("mine") !== "0";
  const showCommunity = searchParams.get("community") === "1";

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  function patchLayers(next: { mine?: boolean; community?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    const mine = next.mine ?? showMine;
    const community = next.community ?? showCommunity;
    if (mine) params.delete("mine");
    else params.set("mine", "0");
    if (community) params.set("community", "1");
    else params.delete("community");
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

  return (
    <>
      <header
        className="flex h-14 items-center gap-3 px-3 sm:h-16 sm:gap-4 sm:px-5 safe-pt"
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
            placeholder="Search places or addresses…"
            className="h-10 min-h-10 rounded-xl border-[var(--color-border)] bg-[var(--color-surface-raised)] pl-9 pr-10 text-sm shadow-[var(--elevation-1)] sm:h-11 sm:min-h-11"
            aria-label="Search places"
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

        <div
          className="hidden items-center gap-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-0.5 text-xs font-semibold sm:flex"
          role="group"
          aria-label="Map layers"
        >
          <button
            type="button"
            aria-pressed={showMine}
            onClick={() => patchLayers({ mine: !showMine })}
            className={cn(
              "rounded-lg px-3 py-2 transition-colors duration-150",
              showMine
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]",
            )}
          >
            My places
          </button>
          <button
            type="button"
            aria-pressed={showCommunity}
            onClick={() => patchLayers({ community: !showCommunity })}
            className={cn(
              "rounded-lg px-3 py-2 transition-colors duration-150",
              showCommunity
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]",
            )}
          >
            Community
          </button>
        </div>

        <UserAvatarMenu />
      </header>

      <div
        className="flex items-center justify-center gap-1 px-3 py-2 sm:hidden"
        style={{
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
        role="group"
        aria-label="Map layers"
      >
        <button
          type="button"
          aria-pressed={showMine}
          onClick={() => patchLayers({ mine: !showMine })}
          className={cn(
            "min-h-10 flex-1 rounded-lg text-sm font-semibold transition-colors",
            showMine
              ? "bg-[var(--color-brand)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]",
          )}
        >
          My places
        </button>
        <button
          type="button"
          aria-pressed={showCommunity}
          onClick={() => patchLayers({ community: !showCommunity })}
          className={cn(
            "min-h-10 flex-1 rounded-lg text-sm font-semibold transition-colors",
            showCommunity
              ? "bg-[var(--color-brand)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]",
          )}
        >
          Community
        </button>
      </div>
    </>
  );
}
