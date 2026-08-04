"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Candidate = {
  placeAId: string;
  placeASlug: string;
  placeAName: string;
  placeBId: string;
  placeBSlug: string;
  placeBName: string;
  distanceM: number;
};

export function MergesClient() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [survivorId, setSurvivorId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadCandidates() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/admin/merge-places?limit=25");
        const json = (await res.json()) as {
          error?: string;
          candidates?: Candidate[];
        };
        if (!res.ok) {
          setMessage(json.error ?? "Could not load candidates.");
          setCandidates([]);
          return;
        }
        setCandidates(json.candidates ?? []);
      } catch {
        setMessage("Network error loading candidates.");
      }
    });
  }

  useEffect(() => {
    loadCandidates();
  }, []);

  function merge(survivorPlaceId: string, loserPlaceId: string, mergeNote?: string) {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/admin/merge-places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            survivorPlaceId,
            loserPlaceId,
            note: mergeNote || null,
          }),
        });
        const json = (await res.json()) as {
          error?: string;
          result?: { survivor_slug?: string; loser_slug?: string };
        };
        if (!res.ok) {
          setMessage(json.error ?? "Merge failed.");
          return;
        }
        setMessage(
          `Merged ${json.result?.loser_slug ?? loserPlaceId} → ${json.result?.survivor_slug ?? survivorPlaceId}.`,
        );
        setSurvivorId("");
        setLoserId("");
        setNote("");
        loadCandidates();
      } catch {
        setMessage("Network error during merge.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-2xl border border-border/60 bg-sand/30 p-4">
        <h2 className="font-display text-xl text-ink">Manual merge</h2>
        <p className="text-sm text-muted">
          Survivor keeps the canonical policy. Loser becomes{" "}
          <code className="text-xs">duplicate_merged</code> and children reparent.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Survivor place ID
          <input
            className="min-h-11 rounded-xl border border-border/60 bg-white px-3 font-mono text-xs"
            value={survivorId}
            onChange={(e) => setSurvivorId(e.target.value.trim())}
            placeholder="uuid"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Loser place ID
          <input
            className="min-h-11 rounded-xl border border-border/60 bg-white px-3 font-mono text-xs"
            value={loserId}
            onChange={(e) => setLoserId(e.target.value.trim())}
            placeholder="uuid"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Note (optional)
          <input
            className="min-h-11 rounded-xl border border-border/60 bg-white px-3"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why these are the same place"
          />
        </label>
        <Button
          type="button"
          disabled={pending || !survivorId || !loserId}
          onClick={() => merge(survivorId, loserId, note)}
        >
          Merge loser into survivor
        </Button>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-ink">Nearby same-name candidates</h2>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={loadCandidates}>
            Refresh
          </Button>
        </div>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">No automatic candidates within ~150m.</p>
        ) : (
          <ul className="space-y-3">
            {candidates.map((c) => (
              <li
                key={`${c.placeAId}-${c.placeBId}`}
                className="rounded-2xl border border-border/60 px-4 py-3"
              >
                <p className="text-sm text-ink">
                  <Link href={`/place/${c.placeASlug}`} className="text-teal-deep underline-offset-2 hover:underline">
                    {c.placeAName}
                  </Link>
                  {" · "}
                  <Link href={`/place/${c.placeBSlug}`} className="text-teal-deep underline-offset-2 hover:underline">
                    {c.placeBName}
                  </Link>
                </p>
                <p className="mt-1 text-xs text-muted">
                  ~{Math.round(c.distanceM)}m apart · A {c.placeAId.slice(0, 8)} · B{" "}
                  {c.placeBId.slice(0, 8)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => merge(c.placeAId, c.placeBId, "auto-candidate: keep A")}
                  >
                    Keep A, merge B
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => merge(c.placeBId, c.placeAId, "auto-candidate: keep B")}
                  >
                    Keep B, merge A
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message ? (
        <p className="rounded-xl border border-border/60 bg-sand/40 px-4 py-3 text-sm text-ink">
          {message}
        </p>
      ) : null}
    </div>
  );
}
