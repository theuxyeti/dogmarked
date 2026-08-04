"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { UserAvatarMenu } from "@/components/layout/user-avatar-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type OverlayMode = "mine" | "others";

/**
 * Compact MVP header: wordmark, search, My places / Other people, avatar.
 * No Community / equal-weight nav destinations.
 */
export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const overlay = (searchParams.get("overlay") as OverlayMode) || "mine";

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setQuery(q);
  }, [searchParams]);

  function setOverlay(mode: OverlayMode) {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "mine") params.delete("overlay");
    else params.set("overlay", mode);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", q);
    router.push(`/explore?${params.toString()}`);
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

        <form onSubmit={onSearchSubmit} className="min-w-0 flex-1 max-w-xl">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places or addresses…"
            className="h-10 min-h-10 rounded-[10px] border-[var(--color-border)] bg-white text-sm sm:h-11 sm:min-h-11"
            aria-label="Search places"
          />
        </form>

        <div className="hidden items-center rounded-full border border-[var(--color-border)] bg-white p-0.5 text-xs font-semibold sm:flex">
          <button
            type="button"
            onClick={() => setOverlay("mine")}
            className={cn(
              "rounded-full px-3 py-2 transition-colors duration-150",
              overlay !== "others"
                ? "bg-[var(--color-brand-600)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            My places
          </button>
          <button
            type="button"
            onClick={() => setOverlay("others")}
            className={cn(
              "rounded-full px-3 py-2 transition-colors duration-150",
              overlay === "others"
                ? "bg-[var(--color-brand-600)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            Other people
          </button>
        </div>

        <UserAvatarMenu />
      </header>

      {/* Mobile overlay toggle under search */}
      <div className="flex items-center justify-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:hidden">
        <button
          type="button"
          onClick={() => setOverlay("mine")}
          className={cn(
            "min-h-10 flex-1 rounded-full text-sm font-semibold",
            overlay !== "others"
              ? "bg-[var(--color-brand-600)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
          )}
        >
          My places
        </button>
        <button
          type="button"
          onClick={() => setOverlay("others")}
          className={cn(
            "min-h-10 flex-1 rounded-full text-sm font-semibold",
            overlay === "others"
              ? "bg-[var(--color-brand-600)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
          )}
        >
          Other people
        </button>
      </div>
    </>
  );
}
