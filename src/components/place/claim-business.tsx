"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function ClaimBusiness({ placeId }: { placeId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofNote, setProofNote] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          businessName: businessName || null,
          contactEmail,
          contactPhone: contactPhone || null,
          proofUrl: proofUrl || null,
          proofNote: proofNote || null,
        }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Could not submit claim.");
        return;
      }
      setMessage(json.message ?? "Claim submitted.");
      setOpen(false);
    } catch {
      setMessage("Network error submitting claim.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-sand/25 px-4 py-4">
      <h3 className="text-sm font-medium text-ink">Own this business?</h3>
      <p className="mt-1 text-xs text-muted">
        Request a claim for review. Approval does not change dog policy confidence or grant
        direct canonical edits.
      </p>
      {!open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setOpen(true)}
        >
          Claim this place
        </Button>
      ) : (
        <form className="mt-3 space-y-3" onSubmit={submit}>
          <label className="flex flex-col gap-1 text-sm">
            Business name
            <input
              className="min-h-11 rounded-xl border border-border/60 bg-white px-3"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Contact email
            <input
              required
              type="email"
              className="min-h-11 rounded-xl border border-border/60 bg-white px-3"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Phone (optional)
            <input
              className="min-h-11 rounded-xl border border-border/60 bg-white px-3"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Proof URL (optional)
            <input
              type="url"
              className="min-h-11 rounded-xl border border-border/60 bg-white px-3"
              placeholder="https://"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Note
            <textarea
              className="min-h-16 rounded-xl border border-border/60 bg-white px-3 py-2 text-sm"
              value={proofNote}
              onChange={(e) => setProofNote(e.target.value)}
              placeholder="How we can verify ownership"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy || !contactEmail}>
              Submit claim
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
