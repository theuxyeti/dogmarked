import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Link to `/place/[slug]` only when a canonical Dogmarked place slug exists. */
export function PlaceLink({
  slug,
  children,
  className,
  disabledClassName,
}: {
  slug?: string | null;
  children: ReactNode;
  className?: string;
  disabledClassName?: string;
}) {
  if (!slug) {
    return (
      <span className={cn(disabledClassName ?? "text-muted", className)}>{children}</span>
    );
  }

  return (
    <Link href={`/place/${slug}`} className={className}>
      {children}
    </Link>
  );
}
