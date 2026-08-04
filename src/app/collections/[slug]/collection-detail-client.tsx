"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Collection, CollectionVisibility } from "@/lib/collections";

type PlaceRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  category: string;
};

type SaveOption = {
  placeId: string;
  name: string;
  slug: string;
};

export function CollectionDetailClient({
  collection: initial,
  places: initialPlaces,
  saveOptions,
  handle,
}: {
  collection: Collection;
  places: PlaceRow[];
  saveOptions: SaveOption[];
  handle: string | null;
}) {
  const router = useRouter();
  const [collection, setCollection] = useState(initial);
  const [places, setPlaces] = useState(initialPlaces);
  const [visibility, setVisibility] = useState<CollectionVisibility>(initial.visibility);
  const [addPlaceId, setAddPlaceId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const availableSaves = useMemo(() => {
    const inCollection = new Set(places.map((p) => p.id));
    return saveOptions.filter((s) => !inCollection.has(s.placeId));
  }, [places, saveOptions]);

  async function updateVisibility(next: CollectionVisibility) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/collections/${collection.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not update visibility.");
        return;
      }
      setVisibility(next);
      setCollection((c) => ({ ...c, visibility: next }));
      setMessage(data.message ?? "Updated.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addPlace() {
    if (!addPlaceId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/collections/${collection.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: addPlaceId }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not add place.");
        return;
      }
      const option = saveOptions.find((s) => s.placeId === addPlaceId);
      if (option) {
        setPlaces((prev) => [
          ...prev,
          {
            id: option.placeId,
            name: option.name,
            slug: option.slug,
            city: null,
            category: "other",
          },
        ]);
      }
      setAddPlaceId("");
      setMessage(data.message ?? "Added.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removePlace(placeId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/collections/${collection.slug}?placeId=${encodeURIComponent(placeId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not remove place.");
        return;
      }
      setPlaces((prev) => prev.filter((p) => p.id !== placeId));
      setMessage(data.message ?? "Removed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const sharePath =
    handle && visibility !== "private"
      ? `/u/${handle}/${collection.slug}`
      : null;

  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <Link href="/collections" className="text-sm text-teal-deep">
        ← Collections
      </Link>
      <h1 className="mt-2 font-display text-3xl text-ink">{collection.title}</h1>
      {collection.description ? (
        <p className="mt-1 text-sm text-muted">{collection.description}</p>
      ) : null}

      <section className="mt-6 space-y-3 rounded-2xl border border-border bg-card/70 p-4">
        <h2 className="text-sm font-medium text-ink">Visibility</h2>
        <p className="text-xs text-muted">
          Private stays on your account. Link is shareable. Public appears on your profile.
        </p>
        <select
          className="flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm"
          value={visibility}
          disabled={busy}
          onChange={(e) => void updateVisibility(e.target.value as CollectionVisibility)}
        >
          <option value="private">Private</option>
          <option value="link">Link only</option>
          <option value="public">Public on profile</option>
        </select>
        {sharePath ? (
          <p className="text-sm text-muted">
            Share URL:{" "}
            <Link href={sharePath} className="text-teal-deep underline">
              {sharePath}
            </Link>
          </p>
        ) : null}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-medium text-ink">Places ({places.length})</h2>
        {availableSaves.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <select
              className="min-h-11 min-w-[12rem] flex-1 rounded-lg border border-border bg-card px-3 text-sm"
              value={addPlaceId}
              onChange={(e) => setAddPlaceId(e.target.value)}
            >
              <option value="">Add from your saves…</option>
              {availableSaves.map((s) => (
                <option key={s.placeId} value={s.placeId}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button type="button" disabled={busy || !addPlaceId} onClick={() => void addPlace()}>
              Add
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Save places on Explore first, then add them here.
          </p>
        )}

        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {places.map((place) => (
            <li key={place.id} className="flex items-center justify-between gap-3 px-3 py-3">
              <Link href={`/place/${place.slug}`} className="min-w-0">
                <span className="font-medium text-ink">{place.name}</span>
                {place.city ? (
                  <span className="mt-0.5 block text-xs text-muted">{place.city}</span>
                ) : null}
              </Link>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void removePlace(place.id)}
              >
                Remove
              </Button>
            </li>
          ))}
          {places.length === 0 ? (
            <li className="px-3 py-6 text-sm text-muted">No places in this collection yet.</li>
          ) : null}
        </ul>
      </section>

      {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
    </main>
  );
}
