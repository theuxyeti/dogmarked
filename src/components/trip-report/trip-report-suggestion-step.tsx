"use client";

import type { NoteSuggestion } from "@/lib/policy/note-parse";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  suggestions: NoteSuggestion[];
  acceptedIds: Set<string>;
  onToggle: (id: string) => void;
  onAcceptAll: () => void;
  onSkipAll: () => void;
  onBack: () => void;
  onContinue: () => void;
};

/**
 * Confirmation gate: parsed note suggestions are never applied until the user
 * accepts, edits later in the form, or skips.
 */
export function TripReportSuggestionStep({
  suggestions,
  acceptedIds,
  onToggle,
  onAcceptAll,
  onSkipAll,
  onBack,
  onContinue,
}: Props) {
  if (suggestions.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          No structured suggestions from this note. You can still fill fields
          manually.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="button" variant="action" onClick={onContinue}>
            Continue to review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg text-[var(--color-ink)]">
          Confirm suggestions
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          We spotted possible policy facts in your note. Nothing is saved until
          you confirm — accept, skip, or edit on the next step.
        </p>
      </div>

      <ul className="space-y-2" role="list">
        {suggestions.map((s) => {
          const on = acceptedIds.has(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(s.id)}
                className={cn(
                  "flex w-full min-h-11 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  on
                    ? "border-[var(--color-brand-600)] bg-[var(--color-brand-soft)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)]",
                )}
              >
                <span className="text-sm font-medium text-[var(--color-ink)]">
                  {on ? "✓ " : ""}
                  {s.label}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  Matched “{s.matchedText}” · {s.confidence} confidence
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onAcceptAll}>
          Accept all
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onSkipAll}>
          Skip all
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" variant="action" onClick={onContinue}>
          Continue to review
        </Button>
      </div>
    </div>
  );
}
