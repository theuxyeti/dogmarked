"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type SavedLibraryStatus = "want_to_go" | "visited" | "recommended";

export interface SavedLibraryItem {
  placeId: string;
  slug: string;
  name: string;
  status: SavedLibraryStatus;
  city?: string | null;
  category?: string | null;
}

const SECTIONS: {
  status: SavedLibraryStatus;
  title: string;
  empty: string;
}[] = [
  {
    status: "want_to_go",
    title: "Want to go",
    empty: "Places you plan to visit will show up here.",
  },
  {
    status: "visited",
    title: "Visited",
    empty: "Mark places you’ve been to build your personal map.",
  },
  {
    status: "recommended",
    title: "Recommended",
    empty: "Highlight spots you’d recommend to other dog owners.",
  },
];

export interface SavedLibraryProps {
  items?: SavedLibraryItem[];
  /** Optional heading override when embedded in /saved */
  title?: string;
}

/**
 * Want / visited / recommended sections for the personal library.
 * Mount from `saved/page.tsx` when Explore agent stubs that route.
 */
export function SavedLibrary({
  items = [],
  title = "Saved",
}: SavedLibraryProps) {
  const [filter, setFilter] = useState<SavedLibraryStatus | "all">("all");

  const grouped = useMemo(() => {
    const map: Record<SavedLibraryStatus, SavedLibraryItem[]> = {
      want_to_go: [],
      visited: [],
      recommended: [],
    };
    for (const item of items) {
      map[item.status]?.push(item);
    }
    return map;
  }, [items]);

  const visibleSections =
    filter === "all" ? SECTIONS : SECTIONS.filter((s) => s.status === filter);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-6">
        <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink,#1c2421)]">
          Dogmarked
        </p>
        <h1 className="mt-2 text-xl font-medium">{title}</h1>
        <p className="mt-1 text-sm text-[var(--ink,#1c2421)]/65">
          Your personal map — private by default. Publishing policy is separate.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
        />
        {SECTIONS.map((s) => (
          <FilterChip
            key={s.status}
            active={filter === s.status}
            onClick={() => setFilter(s.status)}
            label={s.title}
          />
        ))}
      </div>

      <div className="flex flex-col gap-8">
        {visibleSections.map((section) => {
          const list = grouped[section.status];
          return (
            <section key={section.status} aria-labelledby={`saved-${section.status}`}>
              <h2
                id={`saved-${section.status}`}
                className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]"
              >
                {section.title}
                <span className="ml-2 font-normal text-[var(--ink,#1c2421)]/45">
                  {list.length}
                </span>
              </h2>
              {list.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ink,#1c2421)]/55">
                  {section.empty}
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {list.map((item) => (
                    <li key={item.placeId}>
                      <Link
                        href={`/place/${item.slug}`}
                        className="flex min-h-11 items-center justify-between rounded-xl px-3 py-2 hover:bg-[var(--sand,#e8dfd2)]/40"
                      >
                        <span>
                          <span className="font-medium text-[var(--ink,#1c2421)]">
                            {item.name}
                          </span>
                          {item.city ? (
                            <span className="mt-0.5 block text-xs text-[var(--ink,#1c2421)]/55">
                              {item.city}
                              {item.category ? ` · ${item.category}` : ""}
                            </span>
                          ) : null}
                        </span>
                        <span aria-hidden className="text-[var(--ink,#1c2421)]/35">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-sm text-[var(--ink,#1c2421)]/55">
        Organize trips in{" "}
        <Link href="/collections" className="text-[var(--teal,#0f5c56)] underline">
          Collections
        </Link>
        .
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-h-11 rounded-full px-3 text-sm transition",
        active
          ? "bg-[var(--teal,#0f5c56)] text-white"
          : "bg-[var(--sand,#e8dfd2)]/50 text-[var(--ink,#1c2421)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
