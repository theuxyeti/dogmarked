import type { MvpCategoryId } from "@/lib/mvp/taxonomy";

/** Map Foursquare category names / ids to Dogmarked categories. Unknown → other. */
export function mapFsqCategoryToMvp(
  categories: Array<{ id?: string; name?: string } | string> | undefined | null,
): { category: MvpCategoryId; sourceCategory?: string } {
  if (!categories?.length) return { category: "other" };
  const first = categories[0];
  const name =
    typeof first === "string" ? first : (first.name ?? first.id ?? "other");
  const sourceCategory = name;
  const n = name.toLowerCase();

  if (/hotel|lodging|motel|hostel|resort|bed\s*&?\s*breakfast/.test(n)) {
    return { category: "hotel", sourceCategory };
  }
  if (/cafe|café|coffee|bakery|tea\s*room|patisserie/.test(n)) {
    return { category: "cafe", sourceCategory };
  }
  if (/bar|pub|wine|brewery|nightlife|cocktail|tavern|winery/.test(n)) {
    return { category: "bar", sourceCategory };
  }
  if (/restaurant|food|dining|bistro|pizza|dessert|diner|eatery/.test(n)) {
    return { category: "restaurant", sourceCategory };
  }
  if (/beach|shore|coast/.test(n)) return { category: "beach", sourceCategory };
  if (/park|trail|garden|forest|nature|hiking|playground/.test(n)) {
    return { category: "park", sourceCategory };
  }
  if (/museum/.test(n)) {
    return { category: "landmark", sourceCategory };
  }
  if (/attraction|theme\s*park|zoo|aquarium|stadium|theater|theatre/.test(n)) {
    return { category: "attraction", sourceCategory };
  }
  if (/monument|landmark|historic|memorial|castle|church|temple/.test(n)) {
    return { category: "landmark", sourceCategory };
  }
  if (/shop|store|mall|boutique|market|retail/.test(n)) {
    return { category: "shopping", sourceCategory };
  }
  if (/ferry|boat|harbor|harbour|marina|pier/.test(n)) {
    return { category: "ferry", sourceCategory };
  }
  if (/airport|aerodrome|air\s*terminal/.test(n)) {
    return { category: "airport", sourceCategory };
  }
  if (/transit|station|bus|train|metro|subway|rail|transport/.test(n)) {
    return { category: "transit", sourceCategory };
  }
  if (/pet|veterinar|groom|dog\s*park|animal/.test(n)) {
    return { category: "pet_service", sourceCategory };
  }
  if (/city|town|village|locality|destination|neighborhood|neighbourhood/.test(n)) {
    return { category: "destination", sourceCategory };
  }
  return { category: "other", sourceCategory };
}

export function mapOsmOrMapTilerCategory(
  raw: string | null | undefined,
): MvpCategoryId {
  if (!raw) return "other";
  return mapFsqCategoryToMvp([raw]).category;
}
