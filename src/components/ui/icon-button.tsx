import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost: "hover:bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)] hover:text-ink",
        outline:
          "border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]",
        solid: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]",
        soft: "bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)] hover:bg-[var(--color-brand-soft)]/80",
      },
      size: {
        sm: "h-9 w-9 min-h-9 min-w-9",
        default: "h-11 w-11 min-h-11 min-w-11",
        lg: "h-12 w-12 min-h-12 min-w-12",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "default",
    },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Required for a11y — describe the action, not the icon. */
  "aria-label": string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        type={type}
        className={cn(iconButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
IconButton.displayName = "IconButton";

export { iconButtonVariants };
