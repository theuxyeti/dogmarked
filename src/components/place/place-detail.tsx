"use client";

import { useState } from "react";
import Link from "next/link";
import { BookingCta } from "@/components/place/booking-cta";
import { CompatibilityBadge } from "@/components/place/compatibility-badge";
import { Button } from "@/components/ui/button";
import type { AffiliateLink } from "@/lib/affiliates";
import { computeCompatibility } from "@/lib/compatibility";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import { formatCurrency, formatWeight } from "@/lib/units";
import type { DogProfile, PlaceWithPolicy, SaveStatus, SaveVisibility } from "@/lib/types";

function dogStatusLabel(status: string | undefined) {
  switch (status) {
    case "dogs_welcome":
      return "Dogs welcome";
    case "dogs_ok_outdoors":
      return "Dogs OK outdoors";
    case "dogs_ok_with_restrictions":
      return "Dogs OK with restrictions";
    case "ask_first":
      return "Ask first";
    case "no_dogs":
      return "No dogs";
    case "service_animals_only":
      return "Service animals only";
    default:
      return "Dog policy unknown";
  }
}

function formatVerified(iso: string | null | undefined) {
  if (!iso) return "Not yet verified";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PlaceDetail({
  place,
  dogs = DEFAULT_DOG_PROFILES,
  affiliateLink = null,
  onClose,
}: {
  place: PlaceWithPolicy;
  dogs?: DogProfile[];
  affiliateLink?: AffiliateLink | null;
  onClose?: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveVisibility, setSaveVisibility] = useState<SaveVisibility>("private");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const compat = computeCompatibility(dogs, place.policy);
  const policy = place.policy;
  const isClosed = place.status === "closed";

  async function savePlace(status: SaveStatus) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place.id,
          status,
          visibility: saveVisibility,
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean; message?: string };
      if (!res.ok) {
        setMessage(data.error ?? data.message ?? "Could not save place.");
      } else {
        const visNote =
          saveVisibility === "private"
            ? "Private — not on your public profile."
            : saveVisibility === "link"
              ? "Link visibility — shareable, not listed on profile."
              : "Public — may appear on your profile (notes stay private).";
        setMessage(
          data.message ?? `Saved as ${status.replaceAll("_", " ")}. ${visNote}`,
        );
      }
    } catch {
      setMessage("Could not save place.");
    } finally {
      setBusy(false);
    }
  }

  async function publishContribution() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place.id,
          dogStatus: policy?.dogStatus ?? "ask_first",
          access: policy?.access ?? ["outdoor"],
          maxDogs: policy?.maxDogs ?? null,
          maxWeightKg: policy?.maxWeightKg ?? null,
          maxCombinedWeightKg: policy?.maxCombinedWeightKg ?? null,
          smallDogsOnly: policy?.smallDogsOnly ?? false,
          carrierRequired: policy?.carrierRequired ?? false,
          leashRequired: policy?.leashRequired ?? true,
          advanceApprovalRequired: policy?.advanceApprovalRequired ?? false,
          feeType: policy?.feeType ?? "unknown",
          feeAmount: policy?.feeAmount ?? null,
          feeCurrency: policy?.feeCurrency ?? "USD",
          exceptionText: policy?.exceptionText ?? null,
          sourceType: "firsthand",
          promote: true,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string; ok?: boolean };
      if (!res.ok) {
        setMessage(data.error ?? data.message ?? "Contribution failed.");
      } else {
        setMessage(data.message ?? "Contribution submitted.");
      }
    } catch {
      setMessage("Contribution failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reportIncorrect() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place.id,
          reason: "incorrect_policy",
          note: "User flagged policy as incorrect from place detail.",
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      setMessage(
        res.ok
          ? (data.message ?? "Thanks — report filed for review.")
          : (data.error ?? "Could not file report."),
      );
    } catch {
      setMessage("Could not file report.");
    } finally {
      setBusy(false);
    }
  }

  async function markClosed() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/places/${place.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      setMessage(
        res.ok
          ? (data.message ?? "Marked closed.")
          : (data.error ?? "Could not update place status."),
      );
    } catch {
      setMessage("Could not update place status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-4">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {place.category}
              {place.city ? ` · ${place.city}` : ""}
              {isClosed ? " · closed" : ""}
            </p>
            <h2 className="font-display text-2xl text-ink">{place.name}</h2>
            {isClosed ? (
              <p className="mt-1 text-sm font-medium text-danger">
                This place is marked closed — policy may be outdated.
              </p>
            ) : null}
          </div>
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose} className="hidden md:inline-flex">
              Close
            </Button>
          ) : null}
        </div>
        <p className="text-base font-medium text-teal-deep">
          {dogStatusLabel(policy?.dogStatus)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <CompatibilityBadge verdict={compat.verdict} />
          <span className="text-xs text-muted">for Sugar & Munch</span>
        </div>
        <ul className="space-y-1 text-sm text-muted">
          {compat.reasons.map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      </header>

      <section className="space-y-2 border-t border-border pt-3">
        <h3 className="text-sm font-medium text-ink">Restrictions</h3>
        <ul className="grid gap-1 text-sm text-muted">
          <li>Max dogs: {policy?.maxDogs ?? "—"}</li>
          <li>
            Weight:{" "}
            {policy?.maxWeightKg != null
              ? formatWeight(policy.maxWeightKg, weightUnit)
              : "no individual limit"}
            {policy?.maxCombinedWeightKg != null
              ? ` · combined ${formatWeight(policy.maxCombinedWeightKg, weightUnit)}`
              : ""}{" "}
            <button
              type="button"
              className="ml-1 text-xs text-teal-deep underline"
              onClick={() => setWeightUnit((u) => (u === "kg" ? "lb" : "kg"))}
            >
              show {weightUnit === "kg" ? "lb" : "kg"}
            </button>
          </li>
          <li>
            {[
              policy?.leashRequired ? "Leash required" : null,
              policy?.carrierRequired ? "Carrier required" : null,
              policy?.smallDogsOnly ? "Small dogs only" : null,
              policy?.advanceApprovalRequired ? "Advance approval" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No special restrictions listed"}
          </li>
          {policy?.access?.length ? <li>Access: {policy.access.join(", ")}</li> : null}
          {policy?.feeType && policy.feeType !== "none" ? (
            <li>
              Fee:{" "}
              {policy.feeAmount != null
                ? formatCurrency(policy.feeAmount, policy.feeCurrency ?? "USD")
                : "amount unknown"}{" "}
              ({policy.feeType.replaceAll("_", " ")})
            </li>
          ) : (
            <li>No pet fee listed</li>
          )}
        </ul>
      </section>

      {policy?.exceptionText ? (
        <section className="rounded-xl bg-sand/50 px-3 py-3">
          <h3 className="text-sm font-medium text-ink">Exception</h3>
          <p className="mt-1 text-sm text-muted">{policy.exceptionText}</p>
        </section>
      ) : null}

      <section className="space-y-1 text-sm text-muted">
        <p>
          <span className="text-ink">Last verified:</span>{" "}
          {formatVerified(policy?.lastVerifiedAt)}
        </p>
        <p>
          <span className="text-ink">Source:</span>{" "}
          {policy?.sourceType ?? place.sourceType ?? "unverified"}
          {policy?.confidence != null
            ? ` · confidence ${Math.round(policy.confidence * 100)}%`
            : ""}
        </p>
        {place.address ? (
          <p>
            {[place.address, place.city, place.region].filter(Boolean).join(", ")}
          </p>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-border pt-3">
        <div>
          <h3 className="text-sm font-medium text-ink">Personal map</h3>
          <p className="text-xs text-muted">Saving never publishes dog rules. Choose visibility:</p>
          <label className="mt-2 block text-xs text-muted">
            Save visibility
            <select
              className="mt-1 flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink"
              value={saveVisibility}
              onChange={(e) => setSaveVisibility(e.target.value as SaveVisibility)}
            >
              <option value="private">Private</option>
              <option value="link">Link only</option>
              <option value="public">Public on profile</option>
            </select>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy || isClosed} onClick={() => savePlace("want_to_go")} size="sm">
              Save
            </Button>
            <Button
              disabled={busy || isClosed}
              variant="secondary"
              onClick={() => savePlace("visited")}
              size="sm"
            >
              Mark visited
            </Button>
            <Button
              disabled={busy || isClosed}
              variant="outline"
              onClick={() => savePlace("recommended")}
              size="sm"
            >
              Recommend
            </Button>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-ink">Public contribution</h3>
          <p className="text-xs text-muted">
            Submits a policy observation. Canonical promotion is server-only.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy || isClosed} variant="outline" onClick={publishContribution} size="sm">
              Publish policy note
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/add?place=${place.slug}`}>Full policy form</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/place/${place.slug}`}>Open page</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} variant="ghost" size="sm" onClick={reportIncorrect}>
            Report incorrect
          </Button>
          {!isClosed ? (
            <Button disabled={busy} variant="ghost" size="sm" onClick={markClosed}>
              Mark closed
            </Button>
          ) : null}
        </div>
      </section>
      <BookingCta link={affiliateLink} placeName={place.name} />
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </article>
  );
}
