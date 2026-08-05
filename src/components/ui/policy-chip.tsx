import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type PolicyChipTone =
  | "confirmed"
  | "restricted"
  | "community"
  | "unknown"
  | "not-allowed"
  | "neutral";

const policyChipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[length:var(--text-label)] font-medium tracking-wide",
  {
    variants: {
      tone: {
        confirmed:
          "bg-[var(--policy-confirmed-soft)] text-[var(--policy-confirmed)]",
        restricted:
          "bg-[var(--policy-restricted-soft)] text-[var(--policy-restricted)]",
        community:
          "bg-[var(--policy-community-soft)] text-[var(--policy-community)]",
        unknown: "bg-[var(--policy-unknown-soft)] text-[var(--policy-unknown)]",
        "not-allowed":
          "bg-[var(--policy-not-allowed-soft)] text-[var(--policy-not-allowed)]",
        neutral: "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export function PolicyChip({
  className,
  tone,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof policyChipVariants> & {
    tone?: PolicyChipTone;
  }) {
  return (
    <span className={cn(policyChipVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}
