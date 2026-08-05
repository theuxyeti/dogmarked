import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-teal/12 text-teal-deep",
        secondary: "bg-sand text-ink",
        outline: "border border-border text-muted",
        good: "bg-[var(--policy-confirmed-soft)] text-[var(--policy-confirmed)]",
        ask: "bg-[var(--policy-restricted-soft)] text-[var(--policy-restricted)]",
        bad: "bg-[var(--policy-not-allowed-soft)] text-[var(--policy-not-allowed)]",
        unknown: "bg-[var(--policy-unknown-soft)] text-[var(--policy-unknown)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
