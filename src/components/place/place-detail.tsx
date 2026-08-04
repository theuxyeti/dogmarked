"use client";

import { useState } from "react";
import Link from "next/link";
import { CompatibilityBadge } from "@/components/place/compatibility-badge";
import { Button } from "@/components/ui/button";
import { computeCompatibility } from "@/lib/compatibility";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { DogProfile, PlaceWithPolicy, SaveStatus } from "@/lib/types";

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
  onClose,
}: {
  place: PlaceWithPolicy;
  dogs?: DogProfile[];
  onClose?: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const compat = computeCompatibility(dogs, place.policy);
  const policy = place.policy;

  async function savePlace(status: SaveStatus) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: place.id, status, visibility: "private" }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean; message?: string };
      if (!res.ok) {
        setMessage(data.error ?? data.message ?? "Could not save place.");
      } else {
        setMessage(data.message ?? `Saved as ${status.replaceAll("_", " ")}.`);
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

  return (
    <article className="flex flex-col gap-4">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {place.category}
              {place.city ? ` · ${place.city}` : ""}
            </p>
            <h2 className="font-display text-2xl text-ink">{place.name}</h2>
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
            {policy?.maxWeightKg != null ? `${policy.maxWeightKg} kg` : "no individual limit"}
            {policy?.maxCombinedWeightKg != null
              ? ` · combined ${policy.maxCombinedWeightKg} kg`
              : ""}
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
              Fee: {policy.feeAmount != null ? `${policy.feeCurrency ?? "USD"} ${policy.feeAmount}` : ""}{" "}
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
          <p className="text-xs text-muted">Private by default — never publishes dog rules.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => savePlace("want_to_go")} size="sm">
              Save privately
            </Button>
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => savePlace("visited")}
              size="sm"
            >
              Mark visited
            </Button>
            <Button
              disabled={busy}
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
            <Button disabled={busy} variant="outline" onClick={publishContribution} size="sm">
              Publish policy note
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/place/${place.slug}`}>Open page</Link>
            </Button>
          </div>
        </div>
      </section>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </article>
  );
}
