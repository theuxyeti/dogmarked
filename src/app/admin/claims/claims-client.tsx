"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ClaimRow = {
  id: string;
  place_id: string;
  business_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  proof_url: string | null;
  proof_note: string | null;
  status: string;
  created_at: string;
  places: { name: string; slug: string } | null;
};

export function ClaimsClient() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/claims?status=pending");
        const json = (await res.json()) as { error?: string; claims?: ClaimRow[] };
        if (!res.ok) {
          setMessage(json.error ?? "Could not load claims.");
          setClaims([]);
          return;
        }
        setClaims(json.claims ?? []);
      } catch {
        setMessage("Network error loading claims.");
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  function review(claimId: string, status: "approved" | "rejected") {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/claims", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId, status }),
        });
        const json = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) {
          setMessage(json.error ?? "Review failed.");
          return;
        }
        setMessage(json.message ?? `Claim ${status}.`);
        load();
      } catch {
        setMessage("Network error reviewing claim.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={load}>
          Refresh
        </Button>
      </div>

      {claims.length === 0 ? (
        <p className="text-sm text-muted">No pending business claims.</p>
      ) : (
        <ul className="space-y-3">
          {claims.map((claim) => {
            const place = Array.isArray(claim.places) ? claim.places[0] : claim.places;
            return (
              <li
                key={claim.id}
                className="rounded-2xl border border-border/60 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-ink">
                    {place ? (
                      <Link
                        href={`/place/${place.slug}`}
                        className="text-teal-deep underline-offset-2 hover:underline"
                      >
                        {place.name}
                      </Link>
                    ) : (
                      claim.place_id.slice(0, 8)
                    )}
                  </p>
                  <span className="text-xs uppercase tracking-wide text-muted">
                    {claim.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {claim.business_name ?? "Business"} · {claim.contact_email}
                  {claim.contact_phone ? ` · ${claim.contact_phone}` : ""}
                </p>
                {claim.proof_url ? (
                  <p className="mt-1 text-sm">
                    <a
                      href={claim.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-deep underline-offset-2 hover:underline"
                    >
                      Proof link
                    </a>
                  </p>
                ) : null}
                {claim.proof_note ? (
                  <p className="mt-1 text-sm text-ink">{claim.proof_note}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => review(claim.id, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => review(claim.id, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {message ? (
        <p className="rounded-xl border border-border/60 bg-sand/40 px-4 py-3 text-sm text-ink">
          {message}
        </p>
      ) : null}
    </div>
  );
}
