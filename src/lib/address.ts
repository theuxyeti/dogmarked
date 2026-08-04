/**
 * Country-aware address formatting. Uses structured fields when present.
 */

export interface AddressParts {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  /** Pre-formatted fallback from geocoder / fixtures */
  formatted?: string | null;
}

export function formatAddress(
  parts: AddressParts,
  options?: { singleLine?: boolean },
): string {
  if (parts.formatted?.trim()) {
    return parts.formatted.trim();
  }

  const cc = (parts.countryCode ?? "US").toUpperCase();
  const singleLine = options?.singleLine ?? false;
  const sep = singleLine ? ", " : "\n";

  switch (cc) {
    case "US":
    case "CA":
    case "AU":
      return joinNonEmpty(
        [
          parts.line1,
          parts.line2,
          cityRegionPostalUs(parts),
          cc === "US" ? null : cc,
        ],
        sep,
      );
    case "GB":
    case "UK":
      return joinNonEmpty(
        [parts.line1, parts.line2, parts.city, parts.postalCode, "United Kingdom"],
        sep,
      );
    case "FR":
      return joinNonEmpty(
        [
          parts.line1,
          parts.line2,
          [parts.postalCode, parts.city].filter(Boolean).join(" "),
          "France",
        ],
        sep,
      );
    case "DE":
    case "CH":
    case "AT":
      return joinNonEmpty(
        [
          parts.line1,
          parts.line2,
          [parts.postalCode, parts.city].filter(Boolean).join(" "),
          parts.region,
          countryName(cc),
        ],
        sep,
      );
    case "SE":
    case "NO":
    case "DK":
      return joinNonEmpty(
        [
          parts.line1,
          parts.line2,
          [parts.postalCode, parts.city].filter(Boolean).join(" "),
          countryName(cc),
        ],
        sep,
      );
    case "IT":
    case "ES":
      return joinNonEmpty(
        [
          parts.line1,
          parts.line2,
          [parts.postalCode, parts.city, parts.region]
            .filter(Boolean)
            .join(" "),
          countryName(cc),
        ],
        sep,
      );
    default:
      return joinNonEmpty(
        [
          parts.line1,
          parts.line2,
          [parts.city, parts.region, parts.postalCode]
            .filter(Boolean)
            .join(", "),
          cc,
        ],
        sep,
      );
  }
}

function cityRegionPostalUs(parts: AddressParts): string | null {
  const city = parts.city?.trim();
  const region = parts.region?.trim();
  const postal = parts.postalCode?.trim();
  if (!city && !region && !postal) return null;
  const left = [city, region].filter(Boolean).join(", ");
  return [left, postal].filter(Boolean).join(" ");
}

function joinNonEmpty(
  parts: Array<string | null | undefined>,
  sep: string,
): string {
  return parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(sep);
}

function countryName(cc: string): string {
  const names: Record<string, string> = {
    DE: "Germany",
    CH: "Switzerland",
    AT: "Austria",
    SE: "Sweden",
    NO: "Norway",
    DK: "Denmark",
    IT: "Italy",
    ES: "Spain",
    FR: "France",
  };
  return names[cc] ?? cc;
}

/** Service-animal terminology variant by country (copy hook for Phase 5). */
export function serviceAnimalTerm(countryCode?: string | null): string {
  const cc = (countryCode ?? "US").toUpperCase();
  if (cc === "US") return "service animal";
  if (cc === "GB" || cc === "UK" || cc === "AU" || cc === "CA") {
    return "assistance animal";
  }
  return "assistance animal";
}
