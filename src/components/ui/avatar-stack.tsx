import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type AvatarStackItem = {
  id: string;
  src?: string | null;
  alt?: string;
  fallback?: string;
};

export function AvatarStack({
  items,
  max = 3,
  size = "sm",
  className,
  label,
}: {
  items: AvatarStackItem[];
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Accessible summary, e.g. "Exploring with Sugar & Munch". */
  label?: string;
}) {
  const visible = items.slice(0, max);
  const overflow = Math.max(0, items.length - max);

  return (
    <div
      className={cn("inline-flex items-center", className)}
      role="group"
      aria-label={label}
    >
      {visible.map((item, i) => (
        <Avatar
          key={item.id}
          src={item.src}
          alt={item.alt}
          fallback={item.fallback}
          size={size}
          className={cn(i > 0 && "-ml-2")}
        />
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-lg bg-[var(--color-surface-muted)] font-semibold text-[var(--color-ink-muted)] ring-2 ring-[var(--color-surface)] -ml-2",
            size === "sm" && "h-8 w-8 text-xs",
            size === "md" && "h-10 w-10 text-sm",
            size === "lg" && "h-12 w-12 text-base",
          )}
          aria-hidden
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
