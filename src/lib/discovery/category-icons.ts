import type { MvpCategoryId } from "@/lib/mvp/taxonomy";

export const CATEGORY_ICONS: Record<
  MvpCategoryId,
  { emoji: string; label: string; artworkClass: string }
> = {
  hotel: { emoji: "🏨", label: "Hotel", artworkClass: "bg-[#0B5F59]/15 text-[#0B5F59]" },
  food_drink: {
    emoji: "🍽️",
    label: "Food & Drink",
    artworkClass: "bg-[#EE7D59]/15 text-[#EE7D59]",
  },
  beach: { emoji: "🏖️", label: "Beach", artworkClass: "bg-[#EFE5D2] text-[#084A45]" },
  park: { emoji: "🌲", label: "Park or Trail", artworkClass: "bg-[#0B5F59]/12 text-[#084A45]" },
  attraction: {
    emoji: "🎟️",
    label: "Attraction",
    artworkClass: "bg-[#EE7D59]/12 text-[#EE7D59]",
  },
  landmark: { emoji: "📍", label: "Landmark", artworkClass: "bg-[#64726E]/12 text-[#18221F]" },
  shopping: { emoji: "🛍️", label: "Shopping", artworkClass: "bg-[#EFE5D2] text-[#0B5F59]" },
  transport: {
    emoji: "⛴️",
    label: "Transportation or Ferry",
    artworkClass: "bg-[#0B5F59]/10 text-[#084A45]",
  },
  pet_service: {
    emoji: "🐾",
    label: "Pet Service",
    artworkClass: "bg-[#EE7D59]/10 text-[#EE7D59]",
  },
  other: { emoji: "✨", label: "Other", artworkClass: "bg-[#D8DEDA] text-[#64726E]" },
};

export function categoryEmoji(id: MvpCategoryId | string | undefined): string {
  if (id && id in CATEGORY_ICONS) {
    return CATEGORY_ICONS[id as MvpCategoryId].emoji;
  }
  return CATEGORY_ICONS.other.emoji;
}

export function categoryArtworkClass(id: MvpCategoryId | string | undefined): string {
  if (id && id in CATEGORY_ICONS) {
    return CATEGORY_ICONS[id as MvpCategoryId].artworkClass;
  }
  return CATEGORY_ICONS.other.artworkClass;
}
