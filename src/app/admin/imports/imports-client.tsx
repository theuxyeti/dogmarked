"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ImportsClient() {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onImport() {
    setBusy(true);
    setMessage(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setMessage("Paste valid Overpass JSON (object with elements[]).");
        return;
      }

      const elements = Array.isArray(parsed)
        ? parsed
        : (parsed as { elements?: unknown[] }).elements;

      if (!Array.isArray(elements) || elements.length === 0) {
        setMessage("JSON must include a non-empty elements array.");
        return;
      }

      const res = await fetch("/api/admin/osm-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        mapped?: number;
        placesCreated?: number;
        contributionsCreated?: number;
        errors?: string[];
      };
      if (!res.ok) {
        setMessage(data.error ?? "Import failed.");
        return;
      }
      setMessage(
        [
          data.message,
          `Mapped ${data.mapped ?? 0}; places ${data.placesCreated ?? 0}; drafts ${data.contributionsCreated ?? 0}.`,
          ...(data.errors?.length ? [`Sample errors: ${data.errors.join("; ")}`] : []),
        ]
          .filter(Boolean)
          .join(" "),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-sand/40 px-4 py-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-deep">
        South Florida OSM
      </h2>
      <p className="mt-2 text-sm text-muted">
        Paste Overpass JSON. Creates places + draft contributions with OSM provenance.
        Moderators only. Canonical promote stays server-side.
      </p>
      <textarea
        className="mt-4 min-h-48 w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs"
        placeholder='{"elements":[...]}'
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <Button className="mt-4" disabled={busy || !raw.trim()} onClick={() => void onImport()}>
        {busy ? "Importing…" : "Import Overpass JSON"}
      </Button>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
