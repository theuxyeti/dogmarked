"use client";

import { useState } from "react";

export type PolicyDogStatus =
  | "dogs_welcome"
  | "dogs_ok_outdoors"
  | "dogs_ok_with_restrictions"
  | "ask_first"
  | "service_animals_only"
  | "no_dogs";

export type PolicyAccess =
  | "indoors"
  | "outdoors"
  | "patio"
  | "beach"
  | "rooms"
  | "common_areas";

export type PolicyFeeType =
  | "none"
  | "flat"
  | "per_dog"
  | "per_night"
  | "deposit"
  | "unknown";

export type PolicySourceType =
  | "firsthand"
  | "official_website"
  | "staff"
  | "signage"
  | "other";

export interface PolicyFormValues {
  dogStatus: PolicyDogStatus;
  access: PolicyAccess[];
  maxDogs: number | null;
  maxWeightKg: number | null;
  maxCombinedWeightKg: number | null;
  smallDogsOnly: boolean;
  carrierRequired: boolean;
  leashRequired: boolean;
  advanceApprovalRequired: boolean;
  feeType: PolicyFeeType;
  feeAmount: number | null;
  feeCurrency: string;
  exceptionText: string;
  seasonalNotes: string;
  seasonalStartMonth: number | null;
  seasonalEndMonth: number | null;
  sourceType: PolicySourceType;
  sourceUrl: string;
  observedAt: string;
  evidenceUrl: string;
  evidenceNote: string;
  evidenceAttribution: string;
  evidenceLicense: string;
}

export const EMPTY_POLICY_FORM: PolicyFormValues = {
  dogStatus: "dogs_ok_with_restrictions",
  access: ["outdoors"],
  maxDogs: null,
  maxWeightKg: null,
  maxCombinedWeightKg: null,
  smallDogsOnly: false,
  carrierRequired: false,
  leashRequired: true,
  advanceApprovalRequired: false,
  feeType: "none",
  feeAmount: null,
  feeCurrency: "USD",
  exceptionText: "",
  seasonalNotes: "",
  seasonalStartMonth: null,
  seasonalEndMonth: null,
  sourceType: "firsthand",
  sourceUrl: "",
  observedAt: "",
  evidenceUrl: "",
  evidenceNote: "",
  evidenceAttribution: "",
  evidenceLicense: "",
};

const STATUS_OPTIONS: { value: PolicyDogStatus; label: string }[] = [
  { value: "dogs_welcome", label: "Dogs welcome" },
  { value: "dogs_ok_outdoors", label: "Dogs OK outdoors" },
  { value: "dogs_ok_with_restrictions", label: "OK with restrictions" },
  { value: "ask_first", label: "Ask first" },
  { value: "service_animals_only", label: "Service animals only" },
  { value: "no_dogs", label: "No dogs" },
];

const ACCESS_OPTIONS: { value: PolicyAccess; label: string }[] = [
  { value: "indoors", label: "Indoors" },
  { value: "outdoors", label: "Outdoors" },
  { value: "patio", label: "Patio" },
  { value: "beach", label: "Beach" },
  { value: "rooms", label: "Rooms" },
  { value: "common_areas", label: "Common areas" },
];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export interface PolicyFormExtras {
  evidenceFile: File | null;
  confirmPermanentStorage: boolean;
}

export interface PolicyFormProps {
  initial?: Partial<PolicyFormValues>;
  placeName?: string;
  submitLabel?: string;
  onSubmit: (
    values: PolicyFormValues,
    extras: PolicyFormExtras,
  ) => void | Promise<void>;
}

/**
 * Structured dog-policy contribution form.
 * Groups: status · access · restrictions · cost · exception · source.
 */
export function PolicyForm({
  initial,
  placeName,
  submitLabel = "Submit contribution",
  onSubmit,
}: PolicyFormProps) {
  const [values, setValues] = useState<PolicyFormValues>({
    ...EMPTY_POLICY_FORM,
    ...initial,
    access: initial?.access ?? EMPTY_POLICY_FORM.access,
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [confirmPermanentStorage, setConfirmPermanentStorage] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(partial: Partial<PolicyFormValues>) {
    setValues((v) => ({ ...v, ...partial }));
  }

  function toggleAccess(a: PolicyAccess) {
    setValues((v) => {
      const has = v.access.includes(a);
      return {
        ...v,
        access: has ? v.access.filter((x) => x !== a) : [...v.access, a],
      };
    });
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          if (evidenceFile && !confirmPermanentStorage) {
            setError(
              "Confirm you have rights to store this photo permanently, or remove the file and use a link instead.",
            );
            setPending(false);
            return;
          }
          if (evidenceFile && !values.evidenceLicense.trim()) {
            setError("License is required when uploading a permanent evidence photo.");
            setPending(false);
            return;
          }
          await onSubmit(values, { evidenceFile, confirmPermanentStorage });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Submit failed");
        } finally {
          setPending(false);
        }
      }}
    >
      {placeName ? (
        <p className="text-sm text-[var(--ink,#1c2421)]/65">
          Policy for <span className="font-medium text-[var(--ink,#1c2421)]">{placeName}</span>
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]">
          Status
        </legend>
        <select
          className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
          value={values.dogStatus}
          onChange={(e) => patch({ dogStatus: e.target.value as PolicyDogStatus })}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]">
          Access
        </legend>
        <div className="flex flex-wrap gap-2">
          {ACCESS_OPTIONS.map((o) => {
            const on = values.access.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleAccess(o.value)}
                className={[
                  "min-h-11 rounded-full px-3 text-sm",
                  on
                    ? "bg-[var(--teal,#0f5c56)] text-white"
                    : "bg-[var(--sand,#e8dfd2)]/50 text-[var(--ink,#1c2421)]",
                ].join(" ")}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]">
          Restrictions
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField
            label="Max dogs"
            value={values.maxDogs}
            onChange={(n) => patch({ maxDogs: n })}
          />
          <NumberField
            label="Max weight (kg)"
            value={values.maxWeightKg}
            step="0.1"
            onChange={(n) => patch({ maxWeightKg: n })}
          />
          <NumberField
            label="Max combined (kg)"
            value={values.maxCombinedWeightKg}
            step="0.1"
            onChange={(n) => patch({ maxCombinedWeightKg: n })}
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.smallDogsOnly}
            onChange={(e) => patch({ smallDogsOnly: e.target.checked })}
          />
          Small dogs only
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.carrierRequired}
            onChange={(e) => patch({ carrierRequired: e.target.checked })}
          />
          Carrier required
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.leashRequired}
            onChange={(e) => patch({ leashRequired: e.target.checked })}
          />
          Leash required
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.advanceApprovalRequired}
            onChange={(e) =>
              patch({ advanceApprovalRequired: e.target.checked })
            }
          />
          Advance approval required
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]">
          Cost
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Fee type
            <select
              className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
              value={values.feeType}
              onChange={(e) =>
                patch({ feeType: e.target.value as PolicyFeeType })
              }
            >
              <option value="none">None</option>
              <option value="flat">Flat</option>
              <option value="per_dog">Per dog</option>
              <option value="per_night">Per night</option>
              <option value="deposit">Deposit</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <NumberField
            label="Amount"
            value={values.feeAmount}
            step="0.01"
            onChange={(n) => patch({ feeAmount: n })}
          />
          <label className="flex flex-col gap-1 text-sm">
            Currency
            <input
              className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3 uppercase"
              maxLength={3}
              value={values.feeCurrency}
              onChange={(e) =>
                patch({ feeCurrency: e.target.value.toUpperCase() })
              }
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]">
          Exception
        </legend>
        <textarea
          className="min-h-24 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3 py-2 text-sm"
          placeholder="Known exceptions to the official policy…"
          value={values.exceptionText}
          onChange={(e) => patch({ exceptionText: e.target.value })}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]">
          Seasonal
        </legend>
        <p className="text-xs text-[var(--ink,#1c2421)]/55">
          Optional months when dog access differs (e.g. beach season).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Start month
            <select
              className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
              value={values.seasonalStartMonth ?? ""}
              onChange={(e) =>
                patch({
                  seasonalStartMonth: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">—</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            End month
            <select
              className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
              value={values.seasonalEndMonth ?? ""}
              onChange={(e) =>
                patch({
                  seasonalEndMonth: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">—</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          className="min-h-20 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3 py-2 text-sm"
          placeholder="Seasonal notes (e.g. dogs on beach Oct–May only)…"
          value={values.seasonalNotes}
          onChange={(e) => patch({ seasonalNotes: e.target.value })}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]">
          Evidence
        </legend>
        <p className="text-xs text-[var(--ink,#1c2421)]/55">
          Prefer a link unless you own the photo (or have storage rights). MapTiler / OSM /
          partner images stay link-only.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Evidence URL
          <input
            type="url"
            className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
            placeholder="https://"
            value={values.evidenceUrl}
            onChange={(e) => patch({ evidenceUrl: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Upload photo (optional, permanent storage)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3 py-2 text-sm file:mr-3"
            onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {evidenceFile ? (
          <label className="flex items-start gap-2 text-sm text-[var(--ink,#1c2421)]/80">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmPermanentStorage}
              onChange={(e) => setConfirmPermanentStorage(e.target.checked)}
            />
            <span>
              I own this photo or have rights to store it permanently in Dogmarked
              (not scraped from MapTiler/OSM/partners).
            </span>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          Attribution
          <input
            className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
            placeholder="Photo credit / site name"
            value={values.evidenceAttribution}
            onChange={(e) => patch({ evidenceAttribution: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          License
          <input
            className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
            placeholder="e.g. All rights reserved, CC BY 4.0"
            value={values.evidenceLicense}
            onChange={(e) => patch({ evidenceLicense: e.target.value })}
          />
        </label>
        <textarea
          className="min-h-16 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3 py-2 text-sm"
          placeholder="What this evidence shows…"
          value={values.evidenceNote}
          onChange={(e) => patch({ evidenceNote: e.target.value })}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--teal,#0f5c56)]">
          Source
        </legend>
        <label className="flex flex-col gap-1 text-sm">
          How you know
          <select
            className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
            value={values.sourceType}
            onChange={(e) =>
              patch({ sourceType: e.target.value as PolicySourceType })
            }
          >
            <option value="firsthand">Firsthand visit</option>
            <option value="official_website">Official website</option>
            <option value="staff">Staff / manager</option>
            <option value="signage">Signage on site</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Source URL
          <input
            type="url"
            className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
            placeholder="https://"
            value={values.sourceUrl}
            onChange={(e) => patch({ sourceUrl: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Observed on
          <input
            type="date"
            className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
            value={values.observedAt}
            onChange={(e) => patch({ observedAt: e.target.value })}
          />
        </label>
      </fieldset>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-full bg-[var(--teal,#0f5c56)] px-5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Submitting…" : submitLabel}
      </button>
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type="number"
        min={0}
        step={step}
        className="min-h-11 rounded-xl border border-[var(--ink,#1c2421)]/15 bg-white px-3"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") onChange(null);
          else {
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : null);
          }
        }}
      />
    </label>
  );
}
