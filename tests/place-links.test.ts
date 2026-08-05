import { describe, expect, it } from "vitest";
import {
  defaultLabelForProvider,
  isBookingPropertyUrl,
  isBookingSearchUrl,
  isDisplayablePlaceLink,
  placeLinkClickPath,
  validateBookingPropertyUrl,
  validateOfficialUrl,
  visiblePlaceLinks,
  type PlaceLink,
} from "@/lib/place-links";

const PROPERTY =
  "https://www.booking.com/hotel/fr/domaine-de-l-astragale.en-gb.html";
const PROPERTY_WITH_QUERY =
  "https://www.booking.com/hotel/us/surfers-inn.html?checkin=2026-08-01";
const SEARCH =
  "https://www.booking.com/searchresults.html?ss=Nice&ssne=Nice";
const SEARCH_LANG =
  "https://www.booking.com/searchresults.en-gb.html?ss=Lauterbrunnen";
const CITY = "https://www.booking.com/city/fr/nice.html";

describe("Booking.com URL validation", () => {
  it("accepts normal property listing URLs", () => {
    expect(isBookingPropertyUrl(PROPERTY)).toBe(true);
    expect(isBookingPropertyUrl(PROPERTY_WITH_QUERY)).toBe(true);
    expect(isBookingSearchUrl(PROPERTY)).toBe(false);

    const ok = validateBookingPropertyUrl(PROPERTY);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.url).toContain("booking.com/hotel/fr/");
      expect(ok.externalPropertyId).toBe("domaine-de-l-astragale");
    }
  });

  it("rejects search results pages as unverified", () => {
    expect(isBookingSearchUrl(SEARCH)).toBe(true);
    expect(isBookingSearchUrl(SEARCH_LANG)).toBe(true);
    expect(isBookingPropertyUrl(SEARCH)).toBe(false);
    expect(isBookingPropertyUrl(SEARCH_LANG)).toBe(false);

    const bad = validateBookingPropertyUrl(SEARCH);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.reason).toMatch(/search/i);
    }
  });

  it("rejects city / browse pages and the homepage", () => {
    expect(isBookingSearchUrl(CITY)).toBe(true);
    expect(isBookingPropertyUrl(CITY)).toBe(false);
    expect(isBookingPropertyUrl("https://www.booking.com/")).toBe(false);
    expect(validateBookingPropertyUrl("https://www.booking.com/").ok).toBe(false);
  });

  it("rejects non-Booking hosts for booking validation", () => {
    const bad = validateBookingPropertyUrl("https://example.com/hotel/fr/x.html");
    expect(bad.ok).toBe(false);
  });
});

describe("official URL validation", () => {
  it("accepts https official sites", () => {
    const ok = validateOfficialUrl("https://www.domaine-astragale.com/");
    expect(ok.ok).toBe(true);
  });

  it("rejects Booking search pages even as official", () => {
    expect(validateOfficialUrl(SEARCH).ok).toBe(false);
  });
});

describe("place link display helpers", () => {
  it("uses product labels", () => {
    expect(defaultLabelForProvider("official")).toBe("Official website");
    expect(defaultLabelForProvider("booking")).toBe("View on Booking.com");
  });

  it("builds click hop path", () => {
    expect(placeLinkClickPath("11111111-1111-4111-8111-111111111111")).toBe(
      "/api/place-links/click?id=11111111-1111-4111-8111-111111111111",
    );
  });

  it("hides unverified or invalid booking links", () => {
    const verifiedBooking: PlaceLink = {
      id: "1",
      placeId: "p",
      provider: "booking",
      url: PROPERTY,
      label: "View on Booking.com",
      isAffiliate: false,
      isVerified: true,
    };
    const searchBooking: PlaceLink = {
      ...verifiedBooking,
      id: "2",
      url: SEARCH,
    };
    const unverified: PlaceLink = {
      ...verifiedBooking,
      id: "3",
      isVerified: false,
    };

    expect(isDisplayablePlaceLink(verifiedBooking)).toBe(true);
    expect(isDisplayablePlaceLink(searchBooking)).toBe(false);
    expect(isDisplayablePlaceLink(unverified)).toBe(false);
    expect(visiblePlaceLinks([verifiedBooking, searchBooking, unverified])).toEqual([
      verifiedBooking,
    ]);
  });
});
