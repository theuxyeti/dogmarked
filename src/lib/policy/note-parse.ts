/**
 * Note → structured policy suggestions.
 * NEVER auto-publishes: parsers return suggestions only; the user must confirm/edit/skip.
 */

import type {
  PetPolicyAreas,
  PetPolicyFee,
  PetPolicyOverallStatus,
  PetPolicyRules,
  PetSizeBucket,
} from "@/lib/policy/evidence";

export type NoteSuggestionField =
  | "maxDogs"
  | "fee"
  | "overallStatus"
  | "areas"
  | "rules"
  | "allowedSizes"
  | "weightLimitLb";

export type NoteSuggestionConfidence = "high" | "medium" | "low";

/** Partial structured facts proposed from free text. */
export type NoteSuggestionPatch = {
  overallStatus?: PetPolicyOverallStatus;
  maxDogs?: number;
  weightLimitLb?: number;
  allowedSizes?: PetSizeBucket[];
  areas?: PetPolicyAreas;
  rules?: PetPolicyRules;
  fee?: PetPolicyFee;
};

export type NoteSuggestion = {
  id: string;
  field: NoteSuggestionField;
  label: string;
  confidence: NoteSuggestionConfidence;
  patch: NoteSuggestionPatch;
  matchedText: string;
};

export type NoteParseResult = {
  note: string;
  suggestions: NoteSuggestion[];
};

/**
 * Pluggable note parser. Implementations must be side-effect free and
 * must never persist or publish — suggestions only.
 */
export interface NoteParser {
  parse(note: string): NoteParseResult;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  $: "USD",
  "£": "GBP",
  "¥": "JPY",
};

function normalize(note: string): string {
  return note.replace(/\s+/g, " ").trim();
}

function parseDogCount(token: string): number | null {
  const lower = token.toLowerCase();
  if (WORD_NUMBERS[lower] != null) return WORD_NUMBERS[lower]!;
  const n = Number(token);
  if (Number.isInteger(n) && n >= 1 && n <= 50) return n;
  return null;
}

function addSuggestion(
  out: NoteSuggestion[],
  seen: Set<string>,
  suggestion: Omit<NoteSuggestion, "id"> & { id?: string },
) {
  const id =
    suggestion.id ??
    `${suggestion.field}:${JSON.stringify(suggestion.patch)}:${suggestion.matchedText}`;
  if (seen.has(id)) return;
  seen.add(id);
  out.push({ ...suggestion, id });
}

/**
 * Deterministic regex/heuristic parser for common trip-report phrasing.
 * Conservative: only emits suggestions with clear textual anchors.
 */
export class DeterministicNoteParser implements NoteParser {
  parse(note: string): NoteParseResult {
    const trimmed = normalize(note);
    if (!trimmed) {
      return { note: trimmed, suggestions: [] };
    }

    const suggestions: NoteSuggestion[] = [];
    const seen = new Set<string>();
    const lower = trimmed.toLowerCase();

    // --- max dogs: "two dogs", "2 dogs", "max 2 dogs", "up to three dogs" ---
    const maxDogsPatterns: RegExp[] = [
      /\b(?:max(?:imum)?|up to|only)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+dogs?\b/gi,
      /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+dogs?\s+(?:max(?:imum)?|allowed|permitted|ok|okay|welcome)\b/gi,
      /\b(?:brought|with|had|for)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+dogs?\b/gi,
      /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+dogs?\b/gi,
    ];
    for (const re of maxDogsPatterns) {
      re.lastIndex = 0;
      const m = re.exec(trimmed);
      if (!m) continue;
      const count = parseDogCount(m[1]!);
      if (count == null) continue;
      addSuggestion(suggestions, seen, {
        field: "maxDogs",
        label:
          count === 1
            ? "Suggests 1 dog (from note)"
            : `Suggests ${count} dogs (from note)`,
        confidence: /max|up to|only/i.test(m[0]) ? "high" : "medium",
        patch: { maxDogs: count },
        matchedText: m[0],
      });
      break;
    }

    // --- fee: "€40 for the stay", "$25 per night", "pet fee of 40 USD" ---
    const feeMatchers: Array<{
      re: RegExp;
      currencyFrom?: (m: RegExpExecArray) => string | undefined;
      amountFrom: (m: RegExpExecArray) => number | null;
      basisFrom?: (m: RegExpExecArray) => PetPolicyFee["basis"] | undefined;
    }> = [
      {
        re: /([€$£¥])\s*(\d+(?:[.,]\d{1,2})?)(?:\s*(?:for|per)\s+(?:the\s+)?(stay|night|pet|dog|deposit))?/gi,
        currencyFrom: (m) => CURRENCY_SYMBOLS[m[1]!],
        amountFrom: (m) => parseAmount(m[2]!),
        basisFrom: (m) => basisFromWord(m[3]),
      },
      {
        re: /\b(\d+(?:[.,]\d{1,2})?)\s*(EUR|USD|GBP|CHF|CAD|AUD)\b(?:\s*(?:for|per)\s+(?:the\s+)?(stay|night|pet|dog|deposit))?/gi,
        currencyFrom: (m) => m[2]!.toUpperCase(),
        amountFrom: (m) => parseAmount(m[1]!),
        basisFrom: (m) => basisFromWord(m[3]),
      },
      {
        re: /\b(?:pet\s+)?(?:fee|charge|surcharge)\s+(?:of\s+)?([€$£¥])?\s*(\d+(?:[.,]\d{1,2})?)\s*(EUR|USD|GBP)?(?:\s*(?:for|per)\s+(?:the\s+)?(stay|night|pet|dog|deposit))?/gi,
        currencyFrom: (m) =>
          (m[1] ? CURRENCY_SYMBOLS[m[1]] : undefined) ??
          (m[3] ? m[3].toUpperCase() : undefined),
        amountFrom: (m) => parseAmount(m[2]!),
        basisFrom: (m) => basisFromWord(m[4]),
      },
    ];

    for (const matcher of feeMatchers) {
      matcher.re.lastIndex = 0;
      const m = matcher.re.exec(trimmed);
      if (!m) continue;
      const amount = matcher.amountFrom(m);
      if (amount == null) continue;
      const currency = matcher.currencyFrom?.(m) ?? "USD";
      const basis = matcher.basisFrom?.(m) ?? inferBasis(m[0]);
      const fee: PetPolicyFee = { amount, currency, basis };
      addSuggestion(suggestions, seen, {
        field: "fee",
        label: formatFeeLabel(fee),
        confidence: "high",
        patch: { fee },
        matchedText: m[0].trim(),
      });
      break;
    }

    // --- areas: dining / rooms / beach / pool / patio ---
    parseAreaDenials(trimmed, lower, suggestions, seen);
    parseAreaAllows(trimmed, lower, suggestions, seen);

    // --- rules ---
    if (/\bleash(?:es)?\s+required\b/i.test(trimmed)) {
      const m = trimmed.match(/\bleash(?:es)?\s+required\b/i)!;
      addSuggestion(suggestions, seen, {
        field: "rules",
        label: "Leash required",
        confidence: "high",
        patch: { rules: { leashRequired: true } },
        matchedText: m[0],
      });
    }
    if (/\bcarrier\s+required\b/i.test(trimmed)) {
      const m = trimmed.match(/\bcarrier\s+required\b/i)!;
      addSuggestion(suggestions, seen, {
        field: "rules",
        label: "Carrier required",
        confidence: "high",
        patch: { rules: { carrierRequired: true } },
        matchedText: m[0],
      });
    }
    if (
      /\b(?:prior|advance)\s+approval\s+required\b/i.test(trimmed) ||
      /\bmust\s+(?:ask|call|email)\s+(?:ahead|first|in advance)\b/i.test(trimmed)
    ) {
      const m =
        trimmed.match(/\b(?:prior|advance)\s+approval\s+required\b/i) ??
        trimmed.match(/\bmust\s+(?:ask|call|email)\s+(?:ahead|first|in advance)\b/i)!;
      addSuggestion(suggestions, seen, {
        field: "rules",
        label: "Prior approval required",
        confidence: "medium",
        patch: {
          rules: { priorApprovalRequired: true },
          overallStatus: "ask_first",
        },
        matchedText: m[0],
      });
    }
    if (/\bbreed\s+restrictions?\b/i.test(trimmed)) {
      const m = trimmed.match(/\bbreed\s+restrictions?\b/i)!;
      addSuggestion(suggestions, seen, {
        field: "rules",
        label: "Breed restrictions",
        confidence: "high",
        patch: { rules: { breedRestrictions: true } },
        matchedText: m[0],
      });
    }

    // --- weight ---
    const weightM = trimmed.match(
      /\b(?:up to|max(?:imum)?|under|below)?\s*(\d{1,3})\s*(?:lb|lbs|pounds)\b/i,
    );
    if (weightM) {
      const lb = Number(weightM[1]);
      if (lb > 0 && lb <= 500) {
        addSuggestion(suggestions, seen, {
          field: "weightLimitLb",
          label: `Weight limit about ${lb} lb`,
          confidence: /max|up to|under|below/i.test(weightM[0])
            ? "high"
            : "medium",
          patch: { weightLimitLb: lb },
          matchedText: weightM[0],
        });
      }
    }

    // --- size buckets ---
    if (/\bsmall\s+dogs?\s+only\b/i.test(trimmed)) {
      const m = trimmed.match(/\bsmall\s+dogs?\s+only\b/i)!;
      addSuggestion(suggestions, seen, {
        field: "allowedSizes",
        label: "Small dogs only",
        confidence: "high",
        patch: { allowedSizes: ["small"] },
        matchedText: m[0],
      });
    }

    // --- overall status (last so area denials can set restricted first) ---
    parseOverallStatus(trimmed, suggestions, seen);

    return { note: trimmed, suggestions };
  }
}

function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function basisFromWord(
  word: string | undefined,
): PetPolicyFee["basis"] | undefined {
  if (!word) return undefined;
  const w = word.toLowerCase();
  if (w === "stay") return "per_stay";
  if (w === "night") return "per_night";
  if (w === "pet" || w === "dog") return "per_pet";
  if (w === "deposit") return "deposit";
  return undefined;
}

function inferBasis(matched: string): PetPolicyFee["basis"] | undefined {
  const m = matched.toLowerCase();
  if (/\bstay\b/.test(m)) return "per_stay";
  if (/\bnight\b/.test(m)) return "per_night";
  if (/\bdeposit\b/.test(m)) return "deposit";
  if (/\b(?:per\s+)?(?:pet|dog)\b/.test(m)) return "per_pet";
  return undefined;
}

function formatFeeLabel(fee: PetPolicyFee): string {
  const amount = fee.amount != null ? String(fee.amount) : "?";
  const currency = fee.currency ?? "";
  const basis = fee.basis ? ` (${fee.basis.replace(/_/g, " ")})` : "";
  return `Pet fee ${currency} ${amount}${basis}`.replace(/\s+/g, " ").trim();
}

function parseAreaDenials(
  trimmed: string,
  _lower: string,
  suggestions: NoteSuggestion[],
  seen: Set<string>,
) {
  const denials: Array<{
    re: RegExp;
    area: keyof PetPolicyAreas;
    label: string;
  }> = [
    {
      re: /\b(?:not\s+(?:permitted|allowed|welcome)|no\s+dogs?)\s+(?:in\s+)?(?:the\s+)?(?:dining\s+room|indoor\s+dining|restaurant)\b/i,
      area: "indoorDining",
      label: "Not in indoor dining",
    },
    {
      re: /\b(?:not\s+(?:permitted|allowed|welcome)|no\s+dogs?)\s+(?:in\s+)?(?:the\s+)?(?:indoor(?:\s+public)?\s+areas?|inside|indoors)\b/i,
      area: "indoorPublicAreas",
      label: "Not in indoor public areas",
    },
    {
      re: /\b(?:not\s+(?:permitted|allowed|welcome)|no\s+dogs?)\s+(?:in\s+)?(?:the\s+)?(?:guest\s+)?rooms?\b/i,
      area: "guestRooms",
      label: "Not in guest rooms",
    },
    {
      re: /\b(?:not\s+(?:permitted|allowed|welcome)|no\s+dogs?)\s+(?:on\s+)?(?:the\s+)?(?:beach|pool(?:\s+area)?)\b/i,
      area: "beach",
      label: "Not on beach / pool",
    },
  ];

  for (const d of denials) {
    const m = trimmed.match(d.re);
    if (!m) continue;
    let areas: PetPolicyAreas = { [d.area]: false };
    // Shared beach|pool pattern — specialize from matched text
    if (d.area === "beach") {
      const hasBeach = /beach/i.test(m[0]);
      const hasPool = /pool/i.test(m[0]);
      areas = {};
      if (hasBeach) areas.beach = false;
      if (hasPool) areas.poolArea = false;
      if (!hasBeach && !hasPool) areas.beach = false;
    }

    addSuggestion(suggestions, seen, {
      field: "areas",
      label: d.label,
      confidence: "high",
      patch: {
        areas,
        overallStatus: "restricted",
      },
      matchedText: m[0],
    });
  }
}

function parseAreaAllows(
  trimmed: string,
  _lower: string,
  suggestions: NoteSuggestion[],
  seen: Set<string>,
) {
  const allows: Array<{
    re: RegExp;
    area: keyof PetPolicyAreas;
    label: string;
  }> = [
    {
      re: /\b(?:dogs?\s+)?(?:ok|allowed|welcome|permitted)\s+(?:on\s+)?(?:the\s+)?(?:patio|terrace|outdoor\s+dining)\b/i,
      area: "outdoorDining",
      label: "Outdoor dining OK",
    },
    {
      re: /\b(?:dogs?\s+)?(?:ok|allowed|welcome|permitted)\s+(?:in\s+)?(?:the\s+)?(?:guest\s+)?rooms?\b/i,
      area: "guestRooms",
      label: "Guest rooms OK",
    },
    {
      re: /\b(?:dogs?\s+)?(?:ok|allowed|welcome|permitted)\s+(?:on\s+)?(?:the\s+)?grounds?\b/i,
      area: "grounds",
      label: "Grounds OK",
    },
  ];

  for (const a of allows) {
    const m = trimmed.match(a.re);
    if (!m) continue;
    addSuggestion(suggestions, seen, {
      field: "areas",
      label: a.label,
      confidence: "medium",
      patch: { areas: { [a.area]: true } },
      matchedText: m[0],
    });
  }
}

function parseOverallStatus(
  trimmed: string,
  suggestions: NoteSuggestion[],
  seen: Set<string>,
) {
  // Strong negatives
  if (
    /\b(?:dogs?\s+)?(?:not\s+allowed|not\s+permitted|no\s+dogs(?:\s+allowed)?|banned)\b/i.test(
      trimmed,
    ) &&
    !/\b(?:dining|room|indoor|beach|pool|patio)\b/i.test(trimmed)
  ) {
    const m = trimmed.match(
      /\b(?:dogs?\s+)?(?:not\s+allowed|not\s+permitted|no\s+dogs(?:\s+allowed)?|banned)\b/i,
    )!;
    addSuggestion(suggestions, seen, {
      field: "overallStatus",
      label: "Dogs not allowed",
      confidence: "high",
      patch: { overallStatus: "not_allowed" },
      matchedText: m[0],
    });
    return;
  }

  if (/\bask\s+first\b/i.test(trimmed) || /\bcall\s+ahead\b/i.test(trimmed)) {
    const m =
      trimmed.match(/\bask\s+first\b/i) ?? trimmed.match(/\bcall\s+ahead\b/i)!;
    addSuggestion(suggestions, seen, {
      field: "overallStatus",
      label: "Ask first",
      confidence: "high",
      patch: { overallStatus: "ask_first" },
      matchedText: m[0],
    });
    return;
  }

  if (
    /\b(?:dogs?\s+welcome|dog[\s-]?friendly|pets?\s+welcome)\b/i.test(trimmed)
  ) {
    const m = trimmed.match(
      /\b(?:dogs?\s+welcome|dog[\s-]?friendly|pets?\s+welcome)\b/i,
    )!;
    // If we already have area restrictions, don't upgrade to confirmed
    const hasRestrictedArea = suggestions.some(
      (s) => s.patch.overallStatus === "restricted",
    );
    addSuggestion(suggestions, seen, {
      field: "overallStatus",
      label: hasRestrictedArea ? "Dogs with restrictions" : "Dogs welcome",
      confidence: "medium",
      patch: {
        overallStatus: hasRestrictedArea ? "restricted" : "confirmed",
      },
      matchedText: m[0],
    });
  }
}

/** Default parser instance for app use. */
export const defaultNoteParser: NoteParser = new DeterministicNoteParser();

/** Convenience: parse with the default deterministic parser. */
export function parseNoteToSuggestions(note: string): NoteParseResult {
  return defaultNoteParser.parse(note);
}

/**
 * Merge accepted suggestion patches into a draft report shape.
 * Later suggestions overwrite earlier keys for scalar fields; areas/rules deep-merge.
 */
export function applySuggestionPatches(
  base: NoteSuggestionPatch,
  accepted: NoteSuggestion[],
): NoteSuggestionPatch {
  const out: NoteSuggestionPatch = { ...base, areas: { ...base.areas }, rules: { ...base.rules } };
  for (const s of accepted) {
    const p = s.patch;
    if (p.overallStatus != null) out.overallStatus = p.overallStatus;
    if (p.maxDogs != null) out.maxDogs = p.maxDogs;
    if (p.weightLimitLb != null) out.weightLimitLb = p.weightLimitLb;
    if (p.allowedSizes) out.allowedSizes = [...p.allowedSizes];
    if (p.fee) out.fee = { ...p.fee };
    if (p.areas) out.areas = { ...out.areas, ...p.areas };
    if (p.rules) out.rules = { ...out.rules, ...p.rules };
  }
  return out;
}
