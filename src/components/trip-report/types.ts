import type {
  PetPolicyAreas,
  PetPolicyEvidenceType,
  PetPolicyFee,
  PetPolicyOverallStatus,
  PetPolicyReportVisibility,
  PetPolicyRules,
  PetSizeBucket,
} from "@/lib/policy/evidence";

/** Contribution entry modes — same form, different defaults/copy. */
export type TripReportMode =
  | "trip_report"
  | "confirm"
  | "report_change"
  | "add_source";

export type PetOption = {
  id: string;
  name: string;
};

export type TripReportDraft = {
  petIds: string[];
  visitedOn: string;
  note: string;
  visibility: PetPolicyReportVisibility;
  overallStatus: PetPolicyOverallStatus;
  allowedSizes: PetSizeBucket[];
  weightLimitLb: number | null;
  maxDogs: number | null;
  areas: PetPolicyAreas;
  rules: PetPolicyRules;
  fee: PetPolicyFee | null;
  evidenceType: PetPolicyEvidenceType;
  evidenceUrl: string;
};

export const MODE_COPY: Record<
  TripReportMode,
  { title: string; submitLabel: string; blurb: string }
> = {
  trip_report: {
    title: "Add a trip report",
    submitLabel: "Save trip report",
    blurb: "Share what you experienced with your pack. Public reports help others.",
  },
  confirm: {
    title: "Confirm this policy",
    submitLabel: "Confirm policy",
    blurb: "Verify the current dog policy still matches what you found.",
  },
  report_change: {
    title: "Report a change",
    submitLabel: "Report change",
    blurb: "Policy shifted? Tell us what is different now.",
  },
  add_source: {
    title: "Add a policy source",
    submitLabel: "Add source",
    blurb: "Link an official page or listing that documents the dog policy.",
  },
};

export function emptyDraft(mode: TripReportMode): TripReportDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    petIds: [],
    visitedOn: mode === "add_source" ? "" : today,
    note: "",
    visibility: "public",
    overallStatus: mode === "confirm" ? "confirmed" : "unknown",
    allowedSizes: [],
    weightLimitLb: null,
    maxDogs: null,
    areas: {},
    rules: {},
    fee: null,
    evidenceType:
      mode === "add_source"
        ? "official_policy"
        : mode === "confirm"
          ? "direct_confirmation"
          : "firsthand_visit",
    evidenceUrl: "",
  };
}
