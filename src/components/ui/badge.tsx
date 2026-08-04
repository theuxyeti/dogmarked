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
        good: "bg-good/12 text-good",
        ask: "bg-ask/15 text-ask",
        bad: "bg-danger/12 text-danger",
        unknown: "bg-ink/8 text-muted",
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
