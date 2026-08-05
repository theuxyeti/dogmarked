import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type StatusBadgeStatus =
  | "confirmed"
  | "restricted"
  | "community"
  | "unknown"
  | "not-allowed";

const LABELS: Record<StatusBadgeStatus, string> = {
  confirmed: "Confirmed dog-friendly",
  restricted: "Restrictions apply",
  community: "Community reported",
  unknown: "Policy unknown",
  "not-allowed": "Not allowed",
};

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[length:var(--text-caption)] font-semibold tracking-wide",
  {
    variants: {
      status: {
        confirmed:
          "bg-[var(--policy-confirmed-soft)] text-[var(--policy-confirmed)]",
        restricted:
          "bg-[var(--policy-restricted-soft)] text-[var(--policy-restricted)]",
        community:
          "bg-[var(--policy-community-soft)] text-[var(--policy-community)]",
        unknown: "bg-[var(--policy-unknown-soft)] text-[var(--policy-unknown)]",
        "not-allowed":
          "bg-[var(--policy-not-allowed-soft)] text-[var(--policy-not-allowed)]",
      },
    },
    defaultVariants: {
      status: "unknown",
    },
  },
);

export function StatusBadge({
  status = "unknown",
  label,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof statusBadgeVariants> & {
    status?: StatusBadgeStatus;
    /** Override default status label (color is never the only cue). */
    label?: string;
  }) {
  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background:
            status === "confirmed"
              ? "var(--policy-confirmed)"
              : status === "restricted"
                ? "var(--policy-restricted)"
                : status === "community"
                  ? "var(--policy-community)"
                  : status === "not-allowed"
                    ? "var(--policy-not-allowed)"
                    : "var(--policy-unknown)",
        }}
        aria-hidden
      />
      {label ?? LABELS[status]}
    </span>
  );
}
