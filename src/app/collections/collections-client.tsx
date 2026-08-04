"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Collection } from "@/lib/collections";

export function CollectionsClient({
  initialCollections,
  signedIn,
  handle,
}: {
  initialCollections: Collection[];
  signedIn: boolean;
  handle: string | null;
}) {
  const router = useRouter();
  const [collections, setCollections] = useState(initialCollections);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "link" | "public">("private");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || null, visibility }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        collection?: Collection;
      };
      if (!res.ok || !data.collection) {
        setMessage(
          data.error ??
            (res.status === 401 ? "Sign in to create collections." : "Could not create collection."),
        );
        return;
      }
      setCollections((prev) => [data.collection!, ...prev]);
      setTitle("");
      setDescription("");
      setMessage(data.message ?? "Created.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <p className="font-display text-3xl text-teal-deep">Dogmarked</p>
        <h1 className="mt-2 text-xl font-medium text-ink">Collections</h1>
        <p className="mt-1 text-sm text-muted">
          Trip maps and shared lists. Saving privately never publishes policy.
        </p>
      </header>

      {!signedIn ? (
        <p className="mb-6 text-sm text-muted">
          <Link href="/login?next=/collections" className="text-teal-deep underline">
            Sign in
          </Link>{" "}
          to create and manage collections.
        </p>
      ) : (
        <form onSubmit={onCreate} className="mb-8 space-y-3 rounded-2xl border border-border bg-card/70 p-4">
          <h2 className="text-sm font-medium text-ink">New collection</h2>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="South Florida with dogs"
            required
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
          <label className="block text-sm text-muted">
            Visibility
            <select
              className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
            >
              <option value="private">Private</option>
              <option value="link">Link only</option>
              <option value="public">Public on profile</option>
            </select>
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create collection"}
          </Button>
        </form>
      )}

      {message ? <p className="mb-4 text-sm text-muted">{message}</p> : null}

      <ul className="flex flex-col gap-3">
        {collections.map((c) => (
          <li key={c.id}>
            <Link
              href={`/collections/${c.slug}`}
              className="block rounded-2xl bg-sand/40 px-4 py-4 transition hover:bg-sand/70"
            >
              <span className="font-medium text-ink">{c.title}</span>
              {c.description ? (
                <p className="mt-1 text-sm text-muted">{c.description}</p>
              ) : null}
              <p className="mt-2 text-xs uppercase tracking-wide text-teal-deep">
                {c.visibility} · {c.placeIds.length} places
              </p>
              {handle && c.visibility !== "private" ? (
                <p className="mt-1 text-xs text-muted">Share: /u/{handle}/{c.slug}</p>
              ) : null}
            </Link>
          </li>
        ))}
        {collections.length === 0 ? (
          <li className="text-sm text-muted">No collections yet.</li>
        ) : null}
      </ul>
    </main>
  );
}
