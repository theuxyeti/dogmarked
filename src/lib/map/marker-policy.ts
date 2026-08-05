import type { PetPolicyOverallStatus } from "@/lib/policy/evidence";
import type { DogStatus } from "@/lib/types";
import { categoryLabel, type DogBadgeId } from "@/lib/mvp/taxonomy";

/**
 * Marker shell colors (Phase 7). Maps to `--policy-*` tokens.
 * Coral is reserved for temp pins — never used here.
 */
export type MarkerShellStatus =
  | "confirmed"
  | "restricted"
  | "community"
  | "unknown"
  | "not_allowed";

export type DogFriendlyFilterMode = "known_only" | "include_unknown";

const POLICY_PHRASE: Record<MarkerShellStatus, string> = {
  confirmed: "dog policy confirmed",
  restricted: "dog policy with restrictions",
  community: "dog policy community reported",
  unknown: "dog policy unknown",
  not_allowed: "dogs not allowed",
};

const FRIENDLY_BADGES = new Set<string>([
  "dog_friendly",
  "dogs_permitted",
  "indoors_allowed",
  "on_ground",
  "large_dogs_welcome",
  "off_leash",
]);

const RESTRICTED_BADGES = new Set<string>([
  "outdoor_only",
  "carrier_required",
  "small_dogs_only",
  "leash_required",
  "breed_restrictions",
  "prior_approval",
  "pet_fee",
]);

/** Map structured overall status → marker shell (ask_first → restricted/amber). */
export function markerStatusFromOverall(
  status: PetPolicyOverallStatus | null | undefined,
): MarkerShellStatus {
  if (!status || status === "unknown") return "unknown";
  if (status === "ask_first") return "restricted";
  if (status === "confirmed") return "confirmed";
  if (status === "restricted") return "restricted";
  if (status === "not_allowed") return "not_allowed";
  return "unknown";
}

/** Map legacy dog_policies.dog_status → marker shell. */
export function markerStatusFromDogStatus(
  status: DogStatus | string | null | undefined,
): MarkerShellStatus {
  switch (status) {
    case "dogs_welcome":
      return "confirmed";
    case "dogs_ok_outdoors":
    case "dogs_ok_with_restrictions":
    case "ask_first":
      return "restricted";
    case "service_animals_only":
    case "no_dogs":
      return "not_allowed";
    default:
      return "unknown";
  }
}

/**
 * Infer shell from MVP dog badges (Dogmarked evidence only).
 * Friendly-only badges → community (traveler-reported); restriction badges → restricted.
 */
export function markerStatusFromDogBadges(
  badges: Array<DogBadgeId | string> | null | undefined,
): MarkerShellStatus {
  if (!badges?.length) return "unknown";
  const set = new Set(badges);
  if (set.has("unknown") && set.size === 1) return "unknown";

  const hasRestricted = badges.some((b) => RESTRICTED_BADGES.has(b));
  const hasFriendly = badges.some((b) => FRIENDLY_BADGES.has(b));

  if (hasRestricted) return "restricted";
  if (hasFriendly) return "community";
  return "unknown";
}

export type ResolveMarkerPolicyInput = {
  /** Preferred: derived PlacePolicySummary.overallStatus or report status */
  overallStatus?: PetPolicyOverallStatus | null;
  /** Legacy dog_policies row */
  dogStatus?: DogStatus | string | null;
  /** MVP save badges */
  dogBadges?: Array<DogBadgeId | string> | null;
  /**
   * When true and no stronger evidence, treat as community-reported
   * (public Dogmarked save/report presence — not Foursquare friendliness).
   */
  communityReported?: boolean;
};

/**
 * Resolve marker shell from Dogmarked evidence only.
 * Priority: structured overall → dog_policies → badges → community flag → unknown.
 */
export function resolveMarkerPolicyStatus(
  input: ResolveMarkerPolicyInput,
): MarkerShellStatus {
  if (input.overallStatus && input.overallStatus !== "unknown") {
    return markerStatusFromOverall(input.overallStatus);
  }

  if (input.dogStatus) {
    const fromDog = markerStatusFromDogStatus(input.dogStatus);
    if (fromDog !== "unknown") return fromDog;
  }

  const fromBadges = markerStatusFromDogBadges(input.dogBadges);
  if (fromBadges !== "unknown") return fromBadges;

  if (input.communityReported) return "community";

  return "unknown";
}

/** Known dog-friendly = Dogmarked evidence of access (not unknown / not_allowed). */
export function isKnownDogFriendly(status: MarkerShellStatus): boolean {
  return (
    status === "confirmed" ||
    status === "restricted" ||
    status === "community"
  );
}

export function passesDogFriendlyFilter(
  status: MarkerShellStatus,
  mode: DogFriendlyFilterMode,
): boolean {
  if (mode === "include_unknown") return true;
  return isKnownDogFriendly(status);
}

export function markerShellClassName(status: MarkerShellStatus): string {
  const slug = status === "not_allowed" ? "not-allowed" : status;
  return `dm-marker dm-marker--${slug}`;
}

export function markerPolicyPhrase(status: MarkerShellStatus): string {
  return POLICY_PHRASE[status];
}

/** Accessible label: "Hotel, dog policy unknown" */
export function markerAriaLabel(
  category: string | null | undefined,
  status: MarkerShellStatus,
  placeName?: string | null,
): string {
  const cat = categoryLabel(category ?? "other");
  const policy = markerPolicyPhrase(status);
  if (placeName?.trim()) {
    return `${placeName.trim()}, ${cat}, ${policy}`;
  }
  return `${cat}, ${policy}`;
}
