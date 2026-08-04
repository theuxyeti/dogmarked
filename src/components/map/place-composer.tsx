"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DOG_BADGES,
  PLACE_CATEGORIES,
  type DogBadgeId,
  type MvpCategoryId,
  type MvpSaveStatus,
} from "@/lib/mvp/taxonomy";
import { cn } from "@/lib/utils";

export type ComposerDraft = {
  name: string;
  address?: string | null;
  city?: string | null;
  lat: number;
  lng: number;
  category?: MvpCategoryId;
  placeId?: string;
  slug?: string;
};

export type ComposerSavePayload = {
  name: string;
  category: MvpCategoryId;
  status: MvpSaveStatus;
  visibility: "private" | "public";
  note: string;
  dogBadges: DogBadgeId[];
  lat: number;
  lng: number;
  address?: string | null;
  city?: string | null;
  placeId?: string;
};

export function PlaceComposer({
  draft,
  onClose,
  onSave,
  busy,
}: {
  draft: ComposerDraft;
  onClose: () => void;
  onSave: (payload: ComposerSavePayload) => Promise<void>;
  busy?: boolean;
}) {
  const [name, setName] = useState(draft.name);
  const [category, setCategory] = useState<MvpCategoryId>(draft.category ?? "other");
  const [status, setStatus] = useState<MvpSaveStatus>("want_to_go");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [note, setNote] = useState("");
  const [badges, setBadges] = useState<DogBadgeId[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleBadge(id: DogBadgeId) {
    setBadges((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Add a place name.");
      return;
    }
    try {
      await onSave({
        name: name.trim(),
        category,
        status,
        visibility,
        note: note.trim(),
        dogBadges: badges,
        lat: draft.lat,
        lng: draft.lng,
        address: draft.address,
        city: draft.city,
        placeId: draft.placeId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <form className="flex h-full flex-col gap-5 overflow-y-auto p-4 pb-8" onSubmit={submit}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Save to my map
          </p>
          <h2 className="font-display text-2xl text-[var(--color-ink)]">Add a place</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex h-36 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] text-sm text-[var(--color-text-muted)]">
        {PLACE_CATEGORIES.find((c) => c.id === category)?.label ?? "Place"} photo
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold text-[var(--color-ink)]">
        Name
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-[10px]"
          required
        />
      </label>

      {(draft.address || draft.city) && (
        <p className="text-sm text-[var(--color-text-muted)]">
          {[draft.address, draft.city].filter(Boolean).join(" · ")}
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Category</legend>
        <div className="flex flex-wrap gap-2">
          {PLACE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm font-medium transition-colors duration-150",
                category === c.id
                  ? "border-[var(--color-brand-600)] bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
                  : "border-[var(--color-border)] bg-white text-[var(--color-text)]",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Status</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["want_to_go", "Want to go"],
              ["been_there", "Been there"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatus(id)}
              className={cn(
                "min-h-11 rounded-[10px] border text-sm font-semibold",
                status === id
                  ? id === "want_to_go"
                    ? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)] text-[var(--color-ink)]"
                    : "border-[var(--color-brand-600)] bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
                  : "border-[var(--color-border)] bg-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Dog access (optional)</legend>
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">
          Pick what you know. Leave blank if unsure.
        </p>
        <div className="flex flex-wrap gap-2">
          {DOG_BADGES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleBadge(b.id)}
              className={cn(
                "min-h-10 rounded-full border px-3 text-xs font-medium",
                badges.includes(b.id)
                  ? "border-[var(--color-brand-600)] bg-[var(--color-brand-100)]"
                  : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)]",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Note
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What should you remember about this place?"
          className="rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-normal"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Visibility</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["private", "Private"],
              ["public", "Visible to others"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVisibility(id)}
              className={cn(
                "min-h-11 rounded-[10px] border text-sm font-semibold",
                visibility === id
                  ? "border-[var(--color-brand-600)] bg-[var(--color-brand-100)]"
                  : "border-[var(--color-border)] bg-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      <Button
        type="submit"
        disabled={busy}
        className="min-h-12 rounded-[10px] bg-[var(--color-brand-600)] text-base font-semibold hover:bg-[var(--color-brand-700)]"
      >
        {busy ? "Saving…" : "Save to my map"}
      </Button>
    </form>
  );
}
