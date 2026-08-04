import { describe, expect, it } from "vitest";
import {
  AFFILIATE_DISCLOSURE,
  affiliateClickPath,
  assertConfidenceUntouched,
  withAffiliateDisclosure,
  type AffiliateLink,
} from "@/lib/affiliates";

const sample: AffiliateLink = {
  id: "11111111-1111-4111-8111-111111111111",
  placeId: "22222222-2222-4222-8222-222222222222",
  label: "Book stay",
  url: "https://partner.example/hotel?ref=dm",
  network: "example-travel",
  disclosed: true,
  isActive: true,
  createdAt: "2026-03-04T00:00:00.000Z",
  updatedAt: "2026-03-04T00:00:00.000Z",
};

describe("affiliates", () => {
  it("builds a same-origin click hop path", () => {
    expect(affiliateClickPath(sample.id)).toBe(
      `/api/affiliates/click?id=${sample.id}`,
    );
  });

  it("enables disclosed active links only", () => {
    const on = withAffiliateDisclosure(sample);
    expect(on.enabled).toBe(true);
    expect(on.disclosure).toBe(AFFILIATE_DISCLOSURE);

    const off = withAffiliateDisclosure({ ...sample, isActive: false });
    expect(off.enabled).toBe(false);
    expect(off.link).toBeNull();
  });

  it("blocks confidence mutation near affiliate context", () => {
    expect(() =>
      assertConfidenceUntouched(
        { confidence: "high" },
        { confidence: "low" },
      ),
    ).toThrow(/confidence/i);

    expect(
      assertConfidenceUntouched(
        { confidence: "medium" },
        { confidence: "medium" },
      ).confidence,
    ).toBe("medium");
  });
});
