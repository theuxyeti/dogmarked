import { AvatarStack } from "@/components/ui/avatar-stack";
import { CompatibilityBadge } from "@/components/place/compatibility-badge";
import { computeCompatibility } from "@/lib/compatibility";
import { formatActivePackLabel } from "@/lib/pets";
import type { DogPolicy, DogProfile, PetProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  dogs: DogProfile[];
  pets?: PetProfile[];
  policy: DogPolicy | null;
  className?: string;
};

/**
 * Active-pack compatibility with cautious language.
 */
export function PlacePackCompat({ dogs, pets, policy, className }: Props) {
  const compat = computeCompatibility(dogs, policy);
  const packPets =
    pets && pets.length > 0
      ? pets.filter((p) => p.isActive)
      : dogs.map((d) => ({
          id: d.id,
          userId: d.userId ?? "",
          name: d.name,
          photoPath: null as string | null,
          sizeClass: d.sizeClass,
          travelsInCarrier: d.travelsInCarrier,
          isActive: true,
          publicDisplayEnabled: false,
        }));

  const label =
    pets && pets.length > 0
      ? formatActivePackLabel(pets)
      : dogs.length > 0
        ? `Exploring with ${dogs.map((d) => d.name).join(dogs.length === 2 ? " & " : ", ")}`
        : "Add a pet to personalize";

  const cautiousNote =
    compat.verdict === "good_match"
      ? "Looks promising for your pack — still confirm on arrival."
      : compat.verdict === "ask_first"
        ? "Worth checking with the venue before you go."
        : compat.verdict === "not_a_match"
          ? "May not work for your pack based on current reports."
          : "We don’t have enough policy detail to score a match yet.";

  return (
    <section className={cn("space-y-2", className)} aria-label="Pack compatibility">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">Your pack</h3>
        <CompatibilityBadge verdict={compat.verdict} />
      </div>
      <div className="flex items-center gap-3">
        <AvatarStack
          items={packPets.map((p) => ({
            id: p.id,
            src: p.photoPath,
            alt: p.name,
            fallback: p.name.slice(0, 1).toUpperCase(),
          }))}
          label={label}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-ink)]">{label}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">{cautiousNote}</p>
        </div>
      </div>
      {compat.reasons.length > 0 ? (
        <ul className="space-y-1 text-xs text-[var(--color-ink-muted)]">
          {compat.reasons.slice(0, 3).map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
