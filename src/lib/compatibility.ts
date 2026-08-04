import type {
  CompatibilityResult,
  CompatibilityVerdict,
  DogPolicy,
  DogProfile,
} from "@/lib/types";

const LABELS: Record<CompatibilityVerdict, string> = {
  good_match: "Good match",
  ask_first: "Ask first",
  not_a_match: "Not a match",
  unknown: "Unknown",
};

/** Worse verdicts win when combining multi-dog / weight / carrier checks. */
const SEVERITY: Record<CompatibilityVerdict, number> = {
  good_match: 0,
  ask_first: 1,
  unknown: 2,
  not_a_match: 3,
};

function worsen(
  current: CompatibilityVerdict,
  next: CompatibilityVerdict,
): CompatibilityVerdict {
  return SEVERITY[next] > SEVERITY[current] ? next : current;
}

function dogWeightKg(dog: DogProfile): number | null {
  return typeof dog.weightKg === "number" && Number.isFinite(dog.weightKg)
    ? dog.weightKg
    : null;
}

/**
 * Pack-aware compatibility against a place's dog policy.
 *
 * Edge cases:
 * - multi-dog vs maxDogs (Sugar + Munch with maxDogs=1 → ask_first)
 * - individual + combined weight limits
 * - carrier_required when not all dogs travel in a carrier → ask_first
 * - advance approval / ask_first status → ask_first
 */
export function computeCompatibility(
  dogs: DogProfile[],
  policy: DogPolicy | null | undefined,
): CompatibilityResult {
  if (!policy) {
    return {
      verdict: "unknown",
      reasons: ["No verified dog policy yet."],
      label: LABELS.unknown,
    };
  }

  if (policy.dogStatus === "no_dogs") {
    return {
      verdict: "not_a_match",
      reasons: ["Dogs are not allowed at this place."],
      label: LABELS.not_a_match,
    };
  }

  if (policy.dogStatus === "service_animals_only") {
    return {
      verdict: "not_a_match",
      reasons: ["Only service animals are allowed."],
      label: LABELS.not_a_match,
    };
  }

  if (dogs.length === 0) {
    return {
      verdict: "unknown",
      reasons: ["Add a dog profile to personalize this match."],
      label: LABELS.unknown,
    };
  }

  const reasons: string[] = [];
  let verdict: CompatibilityVerdict = "good_match";

  // Multi-dog / max pack size
  if (policy.maxDogs != null && dogs.length > policy.maxDogs) {
    if (policy.maxDogs === 1 && dogs.length > 1) {
      // Classic Sugar + Munch case: venue allows one dog → ask first.
      verdict = worsen(verdict, "ask_first");
      reasons.push(
        `Policy allows ${policy.maxDogs} dog; you have ${dogs.length}. Ask before arriving.`,
      );
    } else {
      verdict = worsen(verdict, "not_a_match");
      reasons.push(
        `Pack size (${dogs.length}) exceeds max dogs (${policy.maxDogs}).`,
      );
    }
  }

  // Individual weight
  if (policy.maxWeightKg != null) {
    const overweight = dogs.filter((d) => {
      const w = dogWeightKg(d);
      return w != null && w > policy.maxWeightKg!;
    });
    const unknownWeight = dogs.filter((d) => dogWeightKg(d) == null);
    if (overweight.length > 0) {
      verdict = worsen(verdict, "not_a_match");
      reasons.push(
        `${overweight.map((d) => d.name).join(", ")} exceed the ${policy.maxWeightKg} kg limit.`,
      );
    } else if (unknownWeight.length > 0) {
      verdict = worsen(verdict, "ask_first");
      reasons.push(
        `Weight unknown for ${unknownWeight.map((d) => d.name).join(", ")}; confirm the ${policy.maxWeightKg} kg limit.`,
      );
    }
  }

  // Combined pack weight
  if (policy.maxCombinedWeightKg != null) {
    const weights = dogs.map(dogWeightKg);
    if (weights.some((w) => w == null)) {
      verdict = worsen(verdict, "ask_first");
      reasons.push(
        "Combined weight cannot be verified — confirm with the venue.",
      );
    } else {
      const combined = weights.reduce<number>((sum, w) => sum + (w ?? 0), 0);
      if (combined > policy.maxCombinedWeightKg) {
        verdict = worsen(verdict, "not_a_match");
        reasons.push(
          `Combined weight (${combined.toFixed(1)} kg) exceeds ${policy.maxCombinedWeightKg} kg.`,
        );
      }
    }
  }

  // Carrier requirement
  if (policy.carrierRequired) {
    const withoutCarrier = dogs.filter((d) => !d.travelsInCarrier);
    if (withoutCarrier.length > 0) {
      verdict = worsen(verdict, "ask_first");
      reasons.push(
        `Carrier required; ${withoutCarrier.map((d) => d.name).join(", ")} not marked as carrier travelers.`,
      );
    }
  }

  if (policy.smallDogsOnly) {
    const tooBig = dogs.filter((d) => {
      const w = dogWeightKg(d);
      return (
        d.sizeClass === "large" ||
        d.sizeClass === "giant" ||
        (w != null && w > 11)
      );
    });
    if (tooBig.length > 0) {
      verdict = worsen(verdict, "not_a_match");
      reasons.push("Small dogs only.");
    }
  }

  if (policy.advanceApprovalRequired) {
    const before = verdict;
    verdict = worsen(verdict, "ask_first");
    if (verdict !== before || before === "good_match") {
      if (!reasons.some((r) => r.includes("Advance approval"))) {
        reasons.push("Advance approval required — confirm before you go.");
      }
    }
  }

  if (policy.dogStatus === "ask_first") {
    verdict = worsen(verdict, "ask_first");
    if (!reasons.some((r) => r.includes("ask-first") || r.includes("Ask before"))) {
      reasons.push("Policy is ask-first — confirm with the venue.");
    }
  }

  if (
    (policy.dogStatus === "dogs_ok_with_restrictions" ||
      policy.dogStatus === "dogs_ok_outdoors") &&
    verdict === "good_match"
  ) {
    reasons.push(
      "Allowed with conditions — review access areas and exceptions.",
    );
  }

  if (reasons.length === 0) {
    reasons.push("Looks compatible with your pack.");
  }

  return { verdict, reasons, label: LABELS[verdict] };
}
