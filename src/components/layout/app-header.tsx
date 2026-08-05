"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { UserAvatarMenu } from "@/components/layout/user-avatar-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Compact MVP header: wordmark, search (preserves query), independent layer toggles, avatar.
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
      <header className="flex h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-3 backdrop-blur sm:h-16 sm:gap-4 sm:px-5 safe-pt">
        <Link
          href="/explore"
          className="shrink-0 font-display text-xl tracking-tight text-[var(--color-brand-600)] sm:text-2xl"
        >
          Dogmarked
        </Link>

        <form onSubmit={onSearchSubmit} className="relative min-w-0 flex-1 max-w-xl">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places or addresses…"
            className="h-10 min-h-10 rounded-[10px] border-[var(--color-border)] bg-white pr-10 text-sm sm:h-11 sm:min-h-11"
            aria-label="Search places"
          />
          {query.trim() ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </form>

        <div className="hidden items-center gap-1 rounded-full border border-[var(--color-border)] bg-white p-0.5 text-xs font-semibold sm:flex">
          <button
            type="button"
            aria-pressed={showMine}
            onClick={() => patchLayers({ mine: !showMine })}
            className={cn(
              "rounded-full px-3 py-2 transition-colors duration-150",
              showMine
                ? "bg-[var(--color-brand-600)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            My places
          </button>
          <button
            type="button"
            aria-pressed={showCommunity}
            onClick={() => patchLayers({ community: !showCommunity })}
            className={cn(
              "rounded-full px-3 py-2 transition-colors duration-150",
              showCommunity
                ? "bg-[var(--color-brand-600)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            Community
          </button>
        </div>

        <UserAvatarMenu />
      </header>

      <div className="flex items-center justify-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:hidden">
        <button
          type="button"
          aria-pressed={showMine}
          onClick={() => patchLayers({ mine: !showMine })}
          className={cn(
            "min-h-10 flex-1 rounded-full text-sm font-semibold",
            showMine
              ? "bg-[var(--color-brand-600)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
          )}
        >
          My places
        </button>
        <button
          type="button"
          aria-pressed={showCommunity}
          onClick={() => patchLayers({ community: !showCommunity })}
          className={cn(
            "min-h-10 flex-1 rounded-full text-sm font-semibold",
            showCommunity
              ? "bg-[var(--color-brand-600)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
          )}
        >
          Community
        </button>
      </div>
    </>
  );
}
