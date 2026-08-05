import type { MvpCategoryId } from "@/lib/mvp/taxonomy";
import { categoryLabel } from "@/lib/mvp/taxonomy";

/**
 * Centralized category emoji registry (Phase 7).
 * Used by markers, nearby list, cards, composer, and empty-state artwork.
 */
export const CATEGORY_ICONS: Record<
  MvpCategoryId,
  { emoji: string; label: string; artworkClass: string }
> = {
  hotel: {
    emoji: "🏨",
    label: "Hotel",
    artworkClass: "bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]",
  },
  restaurant: {
    emoji: "🍽️",
    label: "Restaurant",
    artworkClass: "bg-[var(--color-action-soft)] text-[var(--color-action-hover)]",
  },
  cafe: {
    emoji: "☕",
    label: "Café or bakery",
    artworkClass: "bg-[var(--color-highlight-soft)] text-[var(--color-warning)]",
  },
  bar: {
    emoji: "🍷",
    label: "Bar or winery",
    artworkClass: "bg-[var(--policy-restricted-soft)] text-[var(--policy-restricted)]",
  },
  food_drink: {
    emoji: "🍽️",
    label: "Food & Drink",
    artworkClass: "bg-[var(--color-action-soft)] text-[var(--color-action-hover)]",
  },
  beach: {
    emoji: "🏖️",
    label: "Beach",
    artworkClass: "bg-[var(--color-sand)] text-[var(--color-brand-hover)]",
  },
  park: {
    emoji: "🌲",
    label: "Park or trail",
    artworkClass: "bg-[var(--policy-confirmed-soft)] text-[var(--policy-confirmed)]",
  },
  attraction: {
    emoji: "🎟️",
    label: "Attraction or activity",
    artworkClass: "bg-[var(--color-action-soft)] text-[var(--color-action-hover)]",
  },
  landmark: {
    emoji: "🏛️",
    label: "Landmark or museum",
    artworkClass: "bg-[var(--policy-unknown-soft)] text-[var(--color-ink)]",
  },
  shopping: {
    emoji: "🛍️",
    label: "Shopping",
    artworkClass: "bg-[var(--color-sand)] text-[var(--color-brand)]",
  },
  transit: {
    emoji: "🚆",
    label: "Train or transit",
    artworkClass: "bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]",
  },
  ferry: {
    emoji: "⛴️",
    label: "Ferry or boat",
    artworkClass: "bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]",
  },
  airport: {
    emoji: "✈️",
    label: "Airport",
    artworkClass: "bg-[var(--policy-unknown-soft)] text-[var(--color-ink)]",
  },
  transport: {
    emoji: "⛴️",
    label: "Transportation or ferry",
    artworkClass: "bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]",
  },
  pet_service: {
    emoji: "🐾",
    label: "Pet relief or pet service",
    artworkClass: "bg-[var(--color-action-soft)] text-[var(--color-action-hover)]",
  },
  destination: {
    emoji: "📍",
    label: "Destination",
    artworkClass: "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]",
  },
  other: {
    emoji: "✨",
    label: "Other",
    artworkClass: "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]",
  },
};

export function categoryIconMeta(id: MvpCategoryId | string | undefined | null) {
  if (id && id in CATEGORY_ICONS) {
    return CATEGORY_ICONS[id as MvpCategoryId];
  }
  return {
    ...CATEGORY_ICONS.other,
    label: id ? categoryLabel(id) : CATEGORY_ICONS.other.label,
  };
}

export function categoryEmoji(id: MvpCategoryId | string | undefined | null): string {
  return categoryIconMeta(id).emoji;
}

export function categoryArtworkClass(
  id: MvpCategoryId | string | undefined | null,
): string {
  return categoryIconMeta(id).artworkClass;
}
