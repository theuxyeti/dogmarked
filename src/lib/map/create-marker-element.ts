import { categoryEmoji } from "@/lib/discovery/category-icons";
import {
  markerAriaLabel,
  markerShellClassName,
  type MarkerShellStatus,
} from "@/lib/map/marker-policy";

export type CreateMarkerElementOptions = {
  category?: string | null;
  policyStatus?: MarkerShellStatus | null;
  selected?: boolean;
  emoji?: string | null;
  name?: string | null;
  contributorCount?: number;
  /** Compact candidate pin (still policy-colored, slightly smaller). */
  compact?: boolean;
};

/** Build a branded Dogmarked map marker button (DOM, for MapLibre Marker). */
export function createPolicyMarkerElement(
  options: CreateMarkerElementOptions,
): HTMLButtonElement {
  const status = options.policyStatus ?? "unknown";
  const el = document.createElement("button");
  el.type = "button";
  el.className = markerShellClassName(status);
  if (options.compact) {
    el.classList.add("dm-marker--compact");
  }
  el.dataset.selected = options.selected ? "true" : "false";
  el.dataset.status = status;
  el.setAttribute(
    "aria-label",
    markerAriaLabel(options.category, status, options.name),
  );

  const emojiSpan = document.createElement("span");
  emojiSpan.className = "dm-marker-emoji";
  emojiSpan.setAttribute("aria-hidden", "true");
  emojiSpan.textContent =
    options.emoji ?? categoryEmoji(options.category ?? "other");
  el.appendChild(emojiSpan);

  if (options.contributorCount && options.contributorCount > 1) {
    const badge = document.createElement("span");
    badge.className = "dm-marker-count";
    badge.textContent = String(options.contributorCount);
    el.appendChild(badge);
  }

  return el;
}

export function createClusterMarkerElement(count: number): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "dm-marker dm-marker--cluster";
  el.setAttribute("aria-label", `${count} places`);
  el.textContent = String(count);
  return el;
}
