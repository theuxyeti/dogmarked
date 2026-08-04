"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  title?: string;
  interactive?: boolean;
}

export function SavedLibrary({
  items: initialItems = [],
  title = "Saved",
  interactive = true,
}: SavedLibraryProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<SavedLibraryStatus | "all">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

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

  async function updateStatus(placeId: string, status: SavedLibraryStatus) {
    setMessage(null);
    const res = await fetch("/api/saves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, status, visibility: "private" }),
    });
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) {
      setMessage(data.error ?? "Could not update save.");
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.placeId === placeId ? { ...item, status } : item)),
    );
    setMessage("Updated — still private, not published.");
    startTransition(() => router.refresh());
  }

  async function removeSave(placeId: string) {
    setMessage(null);
    const res = await fetch(`/api/saves?placeId=${encodeURIComponent(placeId)}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(data.error ?? "Could not remove save.");
      return;
    }
    setItems((prev) => prev.filter((item) => item.placeId !== placeId));
    setMessage("Removed from your personal map.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-6">
        <p className="font-display text-3xl text-teal-deep">Dogmarked</p>
        <h1 className="mt-2 text-xl font-medium text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">
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
                className="text-sm font-semibold uppercase tracking-wide text-teal-deep"
              >
                {section.title}
                <span className="ml-2 font-normal text-muted">{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{section.empty}</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {list.map((item) => (
                    <li
                      key={item.placeId}
                      className="rounded-xl border border-border/70 bg-card/60 px-3 py-2"
                    >
                      <div className="flex min-h-11 items-center justify-between gap-3">
                        <Link href={`/place/${item.slug}`} className="min-w-0 flex-1">
                          <span className="font-medium text-ink">{item.name}</span>
                          {item.city ? (
                            <span className="mt-0.5 block text-xs text-muted">
                              {item.city}
                              {item.category ? ` · ${item.category}` : ""}
                            </span>
                          ) : null}
                        </Link>
                        <span aria-hidden className="text-muted">
                          →
                        </span>
                      </div>
                      {interactive ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="text-xs text-muted">
                            Status
                            <select
                              className="ml-2 h-9 rounded-lg border border-border bg-card px-2 text-xs text-ink"
                              value={item.status}
                              disabled={pending}
                              onChange={(e) =>
                                void updateStatus(
                                  item.placeId,
                                  e.target.value as SavedLibraryStatus,
                                )
                              }
                            >
                              <option value="want_to_go">Want to go</option>
                              <option value="visited">Visited</option>
                              <option value="recommended">Recommended</option>
                            </select>
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => void removeSave(item.placeId)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}

      <p className="mt-10 text-sm text-muted">
        Organize trips in{" "}
        <Link href="/collections" className="text-teal-deep underline">
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
        active ? "bg-teal text-primary-foreground" : "bg-foam text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
