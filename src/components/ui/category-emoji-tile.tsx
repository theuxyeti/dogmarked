import {
  categoryArtworkClass,
  categoryEmoji,
  categoryIconMeta,
} from "@/lib/discovery/category-icons";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-12 w-12 text-xl",
} as const;

/**
 * Controlled category emoji — size, alignment, soft background, accessible label.
 * Use for markers (Phase 7), list tiles, empty-state artwork — never raw emoji spam.
 */
export function CategoryEmojiTile({
  category,
  size = "md",
  className,
  label,
}: {
  category?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
  /** Override accessible name (defaults to category label). */
  label?: string;
}) {
  const meta = categoryIconMeta(category);
  return (
    <span
      role="img"
      aria-label={label ?? meta.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg leading-none",
        SIZE[size],
        categoryArtworkClass(category),
        className,
      )}
    >
      <span aria-hidden className="select-none">
        {categoryEmoji(category)}
      </span>
    </span>
  );
}
