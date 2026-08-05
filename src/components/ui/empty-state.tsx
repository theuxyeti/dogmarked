import * as React from "react";
import { cn } from "@/lib/utils";
import { CategoryEmojiTile } from "@/components/ui/category-emoji-tile";
import type { MvpCategoryId } from "@/lib/mvp/taxonomy";

export function EmptyState({
  title,
  description,
  action,
  category = "other",
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Controlled category artwork for the empty illustration. */
  category?: MvpCategoryId | string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-10 text-center",
        className,
      )}
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{
          background:
            "linear-gradient(145deg, var(--color-brand-soft), var(--color-surface-muted))",
        }}
      >
        <CategoryEmojiTile category={category} size="lg" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="font-display text-[length:var(--text-section)] text-ink">{title}</h3>
        {description ? (
          <p className="text-sm text-[var(--color-ink-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
