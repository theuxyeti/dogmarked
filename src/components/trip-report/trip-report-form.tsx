"use client";

import { useState } from "react";
import type {
  PetPolicyAreas,
  PetPolicyEvidenceType,
  PetPolicyFee,
  PetPolicyOverallStatus,
  PetPolicyReport,
  PetPolicyRules,
  PetSizeBucket,
} from "@/lib/policy/evidence";
import {
  applySuggestionPatches,
  parseNoteToSuggestions,
  type NoteSuggestion,
} from "@/lib/policy/note-parse";
import { Button } from "@/components/ui/button";
import { TripReportSuggestionStep } from "@/components/trip-report/trip-report-suggestion-step";
import {
  emptyDraft,
  MODE_COPY,
  type PetOption,
  type TripReportDraft,
  type TripReportMode,
} from "@/components/trip-report/types";

type Step = "compose" | "suggestions" | "review";

const STATUS_OPTIONS: { value: PetPolicyOverallStatus; label: string }[] = [
  { value: "confirmed", label: "Dogs welcome" },
  { value: "restricted", label: "Dogs with restrictions" },
  { value: "ask_first", label: "Ask first" },
  { value: "unknown", label: "Unknown" },
  { value: "not_allowed", label: "Dogs not allowed" },
];

const EVIDENCE_OPTIONS: { value: PetPolicyEvidenceType; label: string }[] = [
  { value: "firsthand_visit", label: "Firsthand visit" },
  { value: "official_policy", label: "Official policy page" },
  { value: "direct_confirmation", label: "Direct confirmation" },
  { value: "provider_listing", label: "Provider listing" },
  { value: "other", label: "Other" },
];

const SIZE_OPTIONS: PetSizeBucket[] = ["small", "medium", "large"];

const AREA_FIELDS: { key: keyof PetPolicyAreas; label: string }[] = [
  { key: "guestRooms", label: "Guest rooms" },
  { key: "indoorPublicAreas", label: "Indoor public" },
  { key: "indoorDining", label: "Indoor dining" },
  { key: "outdoorDining", label: "Outdoor dining" },
  { key: "grounds", label: "Grounds" },
  { key: "beach", label: "Beach" },
  { key: "poolArea", label: "Pool area" },
];

const RULE_FIELDS: { key: keyof PetPolicyRules; label: string }[] = [
  { key: "leashRequired", label: "Leash required" },
  { key: "carrierRequired", label: "Carrier required" },
  { key: "priorApprovalRequired", label: "Prior approval" },
  { key: "breedRestrictions", label: "Breed restrictions" },
];

export type TripReportFormProps = {
  placeId: string;
  placeName?: string;
  mode?: TripReportMode;
  /** Pet / pack options — stub-friendly; empty list hides multi-select. */
  pets?: PetOption[];
  /** Pre-selected pet ids (e.g. active pack). */
  petIds?: string[];
  onCancel?: () => void;
  onSaved?: (report: PetPolicyReport) => void;
};

/**
 * Trip / policy contribution form with note → suggestion confirmation.
 * Suggestions are never auto-published.
 */
export function TripReportForm({
  placeId,
  placeName,
  mode = "trip_report",
  pets = [],
  petIds: initialPetIds,
  onCancel,
  onSaved,
}: TripReportFormProps) {
  const copy = MODE_COPY[mode];
  const [step, setStep] = useState<Step>("compose");
  const [draft, setDraft] = useState<TripReportDraft>(() => {
    const base = emptyDraft(mode);
    if (initialPetIds?.length) base.petIds = [...initialPetIds];
    return base;
  });
  const [suggestions, setSuggestions] = useState<NoteSuggestion[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [officialOnly, setOfficialOnly] = useState(mode === "add_source");

  function patchDraft(partial: Partial<TripReportDraft>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  function togglePet(id: string) {
    setDraft((d) => {
      const has = d.petIds.includes(id);
      return {
        ...d,
        petIds: has ? d.petIds.filter((x) => x !== id) : [...d.petIds, id],
      };
    });
  }

  function toggleSize(size: PetSizeBucket) {
    setDraft((d) => {
      const has = d.allowedSizes.includes(size);
      return {
        ...d,
        allowedSizes: has
          ? d.allowedSizes.filter((s) => s !== size)
          : [...d.allowedSizes, size],
      };
    });
  }

  function setArea(key: keyof PetPolicyAreas, value: boolean | undefined) {
    setDraft((d) => ({
      ...d,
      areas: { ...d.areas, [key]: value },
    }));
  }

  function setRule(key: keyof PetPolicyRules, value: boolean) {
    setDraft((d) => ({
      ...d,
      rules: { ...d.rules, [key]: value },
    }));
  }

  function goToSuggestions() {
    setError(null);
    const parsed = parseNoteToSuggestions(draft.note);
    setSuggestions(parsed.suggestions);
    setAcceptedIds(new Set(parsed.suggestions.map((s) => s.id)));
    setStep("suggestions");
  }

  function applyAcceptedAndReview() {
    const accepted = suggestions.filter((s) => acceptedIds.has(s.id));
    const merged = applySuggestionPatches(
      {
        overallStatus: draft.overallStatus,
        maxDogs: draft.maxDogs ?? undefined,
        weightLimitLb: draft.weightLimitLb ?? undefined,
        allowedSizes: draft.allowedSizes,
        areas: draft.areas,
        rules: draft.rules,
        fee: draft.fee ?? undefined,
      },
      accepted,
    );
    setDraft((d) => ({
      ...d,
      overallStatus: merged.overallStatus ?? d.overallStatus,
      maxDogs: merged.maxDogs ?? d.maxDogs,
      weightLimitLb: merged.weightLimitLb ?? d.weightLimitLb,
      allowedSizes: merged.allowedSizes ?? d.allowedSizes,
      areas: merged.areas ?? d.areas,
      rules: merged.rules ?? d.rules,
      fee: merged.fee ?? d.fee,
    }));
    setStep("review");
  }

  async function submit() {
    setError(null);
    setPending(true);
    try {
      if (officialOnly || mode === "add_source") {
        if (!draft.evidenceUrl.trim()) {
          throw new Error("An official source URL is required.");
        }
        const res = await fetch("/api/policy-evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeId,
            url: draft.evidenceUrl.trim(),
            note: draft.note.trim() || null,
            sourceTitle: placeName ?? null,
            isOfficial: true,
            excerpt: draft.note.trim() || null,
          }),
        });
        const json = (await res.json()) as { error?: unknown; ok?: boolean };
        if (!res.ok) {
          throw new Error(
            typeof json.error === "string"
              ? json.error
              : "Could not save official source.",
          );
        }
        // Also create a lightweight public report when structured fields set
        if (draft.overallStatus !== "unknown" || draft.note.trim()) {
          await postReport();
        } else {
          onSaved?.({
            id: "source-only",
            placeId,
            userId: "",
            petIds: [],
            visitedOn: null,
            visibility: "public",
            overallStatus: "unknown",
            evidenceType: "official_policy",
            evidenceUrl: draft.evidenceUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        return;
      }

      await postReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function postReport() {
    const body = {
      placeId,
      petIds: draft.petIds,
      visitedOn: draft.visitedOn || null,
      visibility: draft.visibility,
      overallStatus: draft.overallStatus,
      allowedSizes: draft.allowedSizes,
      weightLimitLb: draft.weightLimitLb,
      maxDogs: draft.maxDogs,
      areas: draft.areas,
      rules: draft.rules,
      fee: draft.fee,
      note: draft.note.trim() || null,
      evidenceType: draft.evidenceType,
      evidenceUrl: draft.evidenceUrl.trim() || null,
    };

    const res = await fetch("/api/pet-policy-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      report?: PetPolicyReport;
      error?: unknown;
    };
    if (!res.ok || !json.report) {
      throw new Error(
        typeof json.error === "string"
          ? json.error
          : "Could not save trip report. Sign in may be required.",
      );
    }
    onSaved?.(json.report);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="font-display text-xl text-[var(--color-ink)]">
          {copy.title}
        </h2>
        {placeName ? (
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {placeName}
          </p>
        ) : null}
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{copy.blurb}</p>
      </header>

      {step === "compose" ? (
        <div className="space-y-5">
          {pets.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-[var(--color-ink)]">
                Pets / pack
              </legend>
              <div className="flex flex-wrap gap-2">
                {pets.map((p) => {
                  const on = draft.petIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePet(p.id)}
                      className={[
                        "min-h-10 rounded-lg px-3 text-sm",
                        on
                          ? "bg-[var(--color-brand-600)] text-white"
                          : "bg-[var(--color-surface-muted)] text-[var(--color-ink)]",
                      ].join(" ")}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              Pet select unavailable — you can still submit; attach pets later
              when profiles are ready.
            </p>
          )}

          {mode !== "add_source" ? (
            <label className="flex flex-col gap-1 text-sm">
              Visit date
              <input
                type="date"
                className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                value={draft.visitedOn}
                onChange={(e) => patchDraft({ visitedOn: e.target.value })}
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            Note
            <textarea
              className="min-h-28 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              placeholder='e.g. "two dogs, €40 for the stay, not permitted in the dining room"'
              value={draft.note}
              onChange={(e) => patchDraft({ note: e.target.value })}
              maxLength={4000}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Evidence type
            <select
              className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
              value={draft.evidenceType}
              onChange={(e) =>
                patchDraft({
                  evidenceType: e.target.value as PetPolicyEvidenceType,
                })
              }
            >
              {EVIDENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Evidence / source URL
            <input
              type="url"
              className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
              placeholder="https://"
              value={draft.evidenceUrl}
              onChange={(e) => patchDraft({ evidenceUrl: e.target.value })}
            />
          </label>

          {mode === "add_source" ? (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={officialOnly}
                onChange={(e) => setOfficialOnly(e.target.checked)}
              />
              Mark as official policy source
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            Visibility
            <select
              className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
              value={draft.visibility}
              onChange={(e) =>
                patchDraft({
                  visibility: e.target.value as TripReportDraft["visibility"],
                })
              }
            >
              <option value="public">Public (counts toward summary)</option>
              <option value="private">Private (only you)</option>
            </select>
          </label>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
            <Button
              type="button"
              variant="action"
              onClick={() => {
                if (mode === "add_source" && !draft.note.trim()) {
                  setStep("review");
                  return;
                }
                goToSuggestions();
              }}
            >
              {draft.note.trim() ? "Review note suggestions" : "Continue"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "suggestions" ? (
        <TripReportSuggestionStep
          suggestions={suggestions}
          acceptedIds={acceptedIds}
          onToggle={(id) => {
            setAcceptedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onAcceptAll={() =>
            setAcceptedIds(new Set(suggestions.map((s) => s.id)))
          }
          onSkipAll={() => setAcceptedIds(new Set())}
          onBack={() => setStep("compose")}
          onContinue={applyAcceptedAndReview}
        />
      ) : null}

      {step === "review" ? (
        <div className="space-y-5">
          <p className="text-sm text-[var(--color-text-muted)]">
            Edit structured fields before saving. Accepted suggestions are
            prefilled — change anything that looks wrong.
          </p>

          <label className="flex flex-col gap-1 text-sm">
            Overall status
            <select
              className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
              value={draft.overallStatus}
              onChange={(e) =>
                patchDraft({
                  overallStatus: e.target.value as PetPolicyOverallStatus,
                })
              }
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Max dogs
              <input
                type="number"
                min={1}
                max={50}
                className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                value={draft.maxDogs ?? ""}
                onChange={(e) =>
                  patchDraft({
                    maxDogs: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Weight limit (lb)
              <input
                type="number"
                min={1}
                max={500}
                className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                value={draft.weightLimitLb ?? ""}
                onChange={(e) =>
                  patchDraft({
                    weightLimitLb: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Allowed sizes</legend>
            <div className="flex flex-wrap gap-2">
              {SIZE_OPTIONS.map((s) => {
                const on = draft.allowedSizes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSize(s)}
                    className={[
                      "min-h-10 rounded-lg px-3 text-sm capitalize",
                      on
                        ? "bg-[var(--color-brand-600)] text-white"
                        : "bg-[var(--color-surface-muted)]",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Areas</legend>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {AREA_FIELDS.map((a) => {
                const val = draft.areas[a.key];
                return (
                  <label
                    key={a.key}
                    className="flex min-h-10 items-center gap-2 text-sm"
                  >
                    <select
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs"
                      value={
                        val === true ? "yes" : val === false ? "no" : "unset"
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setArea(
                          a.key,
                          v === "yes" ? true : v === "no" ? false : undefined,
                        );
                      }}
                    >
                      <option value="unset">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                    {a.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Rules</legend>
            {RULE_FIELDS.map((r) => (
              <label
                key={r.key}
                className="flex min-h-10 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={draft.rules[r.key] === true}
                  onChange={(e) => setRule(r.key, e.target.checked)}
                />
                {r.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Pet fee</legend>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs">
                Amount
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="min-h-11 rounded-xl border border-[var(--color-border)] px-2"
                  value={draft.fee?.amount ?? ""}
                  onChange={(e) =>
                    patchDraft({
                      fee: {
                        ...(draft.fee ?? {}),
                        amount: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Currency
                <input
                  className="min-h-11 rounded-xl border border-[var(--color-border)] px-2 uppercase"
                  maxLength={3}
                  value={draft.fee?.currency ?? ""}
                  onChange={(e) =>
                    patchDraft({
                      fee: {
                        ...(draft.fee ?? {}),
                        currency: e.target.value.toUpperCase() || undefined,
                      },
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Basis
                <select
                  className="min-h-11 rounded-xl border border-[var(--color-border)] px-2"
                  value={draft.fee?.basis ?? ""}
                  onChange={(e) =>
                    patchDraft({
                      fee: {
                        ...(draft.fee ?? {}),
                        basis: (e.target.value || undefined) as
                          | PetPolicyFee["basis"]
                          | undefined,
                      },
                    })
                  }
                >
                  <option value="">—</option>
                  <option value="per_pet">Per pet</option>
                  <option value="per_night">Per night</option>
                  <option value="per_stay">Per stay</option>
                  <option value="deposit">Deposit</option>
                </select>
              </label>
            </div>
          </fieldset>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("suggestions")}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="action"
              disabled={pending}
              onClick={() => void submit()}
            >
              {pending ? "Saving…" : copy.submitLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
