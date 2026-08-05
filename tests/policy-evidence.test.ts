import { describe, expect, it } from "vitest";
import { chipsFromReport, chipsFromSummary } from "@/lib/policy/chips";
import {
  deriveSummary,
  type PetPolicyReport,
} from "@/lib/policy/evidence";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function report(overrides: Partial<PetPolicyReport>): PetPolicyReport {
  return {
    id: overrides.id ?? "r1",
    placeId: "place-1",
    userId: "user-1",
    petIds: [],
    visitedOn: "2026-06-01",
    visibility: "public",
    overallStatus: "confirmed",
    allowedSizes: ["small", "medium"],
    weightLimitLb: null,
    maxDogs: 2,
    areas: { outdoorDining: true, indoorDining: false },
    rules: { leashRequired: true },
    fee: null,
    note: null,
    evidenceType: "firsthand_visit",
    evidenceUrl: null,
    createdAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveSummary", () => {
  it("counts confirmations when public reports agree", () => {
    const summary = deriveSummary(
      [
        report({ id: "a", overallStatus: "confirmed", visitedOn: "2026-05-01" }),
        report({
          id: "b",
          userId: "user-2",
          overallStatus: "confirmed",
          visitedOn: "2026-07-01",
        }),
      ],
      { now: NOW },
    );

    expect(summary.publicReportCount).toBe(2);
    expect(summary.confirmationCount).toBe(2);
    expect(summary.overallStatus).toBe("confirmed");
    expect(summary.lastConfirmed).toBe("2026-07-01");
    expect(summary.conflicts).toEqual([]);
    expect(summary.staleWarning).toBe(false);
  });

  it("surfaces overallStatus conflicts without overwriting either report", () => {
    const reports = [
      report({
        id: "yes",
        overallStatus: "confirmed",
        visitedOn: "2026-07-15",
      }),
      report({
        id: "no",
        userId: "user-2",
        overallStatus: "not_allowed",
        visitedOn: "2026-07-01",
      }),
    ];

    const summary = deriveSummary(reports, { now: NOW });

    expect(summary.confirmationCount).toBe(1);
    expect(summary.conflicts.some((c) => c.field === "overallStatus")).toBe(
      true,
    );
    // Headline follows most recent; conflict flag preserves disagreement
    expect(summary.overallStatus).toBe("confirmed");
    expect(
      summary.conflicts.find((c) => c.field === "overallStatus")?.values,
    ).toEqual(expect.arrayContaining(["confirmed", "not_allowed"]));
  });

  it("excludes private reports from confirmation counts and conflicts", () => {
    const summary = deriveSummary(
      [
        report({
          id: "private-hostile",
          visibility: "private",
          overallStatus: "not_allowed",
          visitedOn: "2026-07-20",
        }),
        report({
          id: "public-ok",
          userId: "user-2",
          visibility: "public",
          overallStatus: "confirmed",
          visitedOn: "2026-06-01",
        }),
      ],
      { now: NOW },
    );

    expect(summary.publicReportCount).toBe(1);
    expect(summary.confirmationCount).toBe(1);
    expect(summary.overallStatus).toBe("confirmed");
    expect(summary.conflicts).toEqual([]);
  });

  it("flags stale confirmations older than one year", () => {
    const summary = deriveSummary(
      [
        report({
          overallStatus: "confirmed",
          visitedOn: "2024-01-01",
          createdAt: "2024-01-02T00:00:00.000Z",
        }),
      ],
      { now: NOW },
    );

    expect(summary.confirmationCount).toBe(1);
    expect(summary.staleWarning).toBe(true);
  });

  it("detects official sources from reports or evidence rows", () => {
    const fromReport = deriveSummary(
      [
        report({
          evidenceType: "official_policy",
          overallStatus: "restricted",
        }),
      ],
      { now: NOW },
    );
    expect(fromReport.hasOfficialSource).toBe(true);

    const fromEvidence = deriveSummary([report({ evidenceType: "firsthand_visit" })], {
      now: NOW,
      officialEvidence: [
        { isOfficial: true, url: "https://example.com/pets", excerpt: "Dogs welcome" },
      ],
    });
    expect(fromEvidence.hasOfficialSource).toBe(true);
  });

  it("returns unknown with empty public set", () => {
    const summary = deriveSummary(
      [report({ visibility: "private", overallStatus: "confirmed" })],
      { now: NOW },
    );
    expect(summary.overallStatus).toBe("unknown");
    expect(summary.confirmationCount).toBe(0);
    expect(summary.publicReportCount).toBe(0);
  });
});

describe("policy chips", () => {
  it("maps report fields into access/size/areas/rules chips", () => {
    const chips = chipsFromReport(
      report({
        overallStatus: "restricted",
        allowedSizes: ["small"],
        maxDogs: 1,
        weightLimitLb: 25,
        areas: { outdoorDining: true },
        rules: { carrierRequired: true },
        fee: { amount: 50, currency: "USD", basis: "per_stay" },
      }),
    );

    expect(chips.find((c) => c.category === "access")?.label).toBe(
      "Dogs with restrictions",
    );
    expect(chips.some((c) => c.category === "size" && c.label === "Small dogs")).toBe(
      true,
    );
    expect(chips.some((c) => c.category === "areas")).toBe(true);
    expect(chips.some((c) => c.category === "rules" && /Carrier/i.test(c.label))).toBe(
      true,
    );
    expect(chips.some((c) => c.category === "rules" && /50/.test(c.label))).toBe(true);
  });

  it("adds conflict and stale chips from summary", () => {
    const summary = deriveSummary(
      [
        report({ id: "a", overallStatus: "confirmed", visitedOn: "2024-01-01" }),
        report({
          id: "b",
          userId: "u2",
          overallStatus: "ask_first",
          visitedOn: "2024-02-01",
        }),
      ],
      { now: NOW },
    );
    const chips = chipsFromSummary(summary);
    expect(chips.some((c) => c.id === "access:conflict")).toBe(true);
    expect(chips.some((c) => c.id === "access:stale")).toBe(true);
  });
});
