import { Badge } from "@/components/ui/badge";
import type { CompatibilityVerdict } from "@/lib/types";
import { cn } from "@/lib/utils";

const VARIANT: Record<
  CompatibilityVerdict,
  "good" | "ask" | "bad" | "unknown"
> = {
  good_match: "good",
  ask_first: "ask",
  not_a_match: "bad",
  unknown: "unknown",
};

const LABEL: Record<CompatibilityVerdict, string> = {
  good_match: "Good match",
  ask_first: "Ask first",
  not_a_match: "Not a match",
  unknown: "Unknown",
};

export function CompatibilityBadge({
  verdict,
  className,
}: {
  verdict: CompatibilityVerdict;
  className?: string;
}) {
  return (
    <Badge variant={VARIANT[verdict]} className={cn(className)}>
      {LABEL[verdict]}
    </Badge>
  );
}
