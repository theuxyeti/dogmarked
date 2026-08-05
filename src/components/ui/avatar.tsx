"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

export function Avatar({
  src,
  alt = "",
  fallback,
  size = "md",
  className,
}: {
  src?: string | null;
  alt?: string;
  /** Initials or short label when no photo. */
  fallback?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(src) && !failed;
  const initials = (fallback ?? alt ?? "?").slice(0, 2).toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-brand-soft)] font-semibold text-[var(--color-brand-hover)] ring-2 ring-[var(--color-surface)]",
        SIZE[size],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- small avatar; remote pet/user URLs vary
        <img
          src={src!}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden={!alt}>{initials}</span>
      )}
    </span>
  );
}
