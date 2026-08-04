/**
 * Map OSM dog=* / dogs=* tags into policy contribution draft shapes.
 * Output is never a canonical dog_policies row — promote stays server-side.
 */

export interface OsmElementTags {
  dog?: string;
  dogs?: string;
  name?: string;
  amenity?: string;
  leisure?: string;
  tourism?: string;
  [key: string]: string | undefined;
}

export interface OsmElementLike {
  id: number | string;
  type?: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmElementTags;
}

export type OsmMappedDogStatus =
  | "dogs_welcome"
  | "dogs_ok_outdoors"
  | "dogs_ok_with_restrictions"
  | "ask_first"
  | "service_animals_only"
  | "no_dogs"
  | "unknown";

export interface OsmPolicyContributionDraft {
  externalKey: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  dogStatus: OsmMappedDogStatus;
  access: string[];
  leashRequired: boolean;
  carrierRequired: boolean;
  exceptionText: string | null;
  sourceType: "import";
  sourceAttribution: string;
  sourceUrl: string | null;
  confidence: "osm";
  rawTags: OsmElementTags;
  moderationStatus: "draft";
}

const ATTRIBUTION = "© OpenStreetMap contributors";

export function mapOsmDogTag(raw: string | undefined): {
  dogStatus: OsmMappedDogStatus;
  access: string[];
  leashRequired: boolean;
  notes: string[];
} {
  const value = (raw ?? "").trim().toLowerCase();
  const notes: string[] = [];

  switch (value) {
    case "yes":
    case "allowed":
    case "welcome":
      return {
        dogStatus: "dogs_welcome",
        access: ["outdoors"],
        leashRequired: true,
        notes,
      };
    case "leashed":
    case "on_leash":
      notes.push("OSM: leashed only");
      return {
        dogStatus: "dogs_ok_with_restrictions",
        access: ["outdoors"],
        leashRequired: true,
        notes,
      };
    case "unleashed":
    case "off_leash":
      notes.push("OSM: off-leash indicated");
      return {
        dogStatus: "dogs_ok_outdoors",
        access: ["outdoors"],
        leashRequired: false,
        notes,
      };
    case "no":
    case "denied":
      return {
        dogStatus: "no_dogs",
        access: [],
        leashRequired: true,
        notes,
      };
    case "service_dogs":
    case "service":
      return {
        dogStatus: "service_animals_only",
        access: [],
        leashRequired: true,
        notes,
      };
    case "designated":
      notes.push("OSM: designated dog area — confirm access");
      return {
        dogStatus: "ask_first",
        access: ["outdoors"],
        leashRequired: true,
        notes,
      };
    default:
      if (!value) {
        return {
          dogStatus: "unknown",
          access: [],
          leashRequired: true,
          notes,
        };
      }
      notes.push(`Unrecognized OSM dog tag: ${value}`);
      return {
        dogStatus: "ask_first",
        access: ["outdoors"],
        leashRequired: true,
        notes,
      };
  }
}

export function osmElementToContributionDraft(
  el: OsmElementLike,
): OsmPolicyContributionDraft | null {
  const tags = el.tags ?? {};
  const dogRaw = tags.dog ?? tags.dogs;
  if (!dogRaw) return null;

  const mapped = mapOsmDogTag(dogRaw);
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;
  const osmType = el.type ?? "node";

  return {
    externalKey: `osm:${osmType}/${el.id}`,
    name: tags.name?.trim() || null,
    lat,
    lng,
    dogStatus: mapped.dogStatus,
    access: mapped.access,
    leashRequired: mapped.leashRequired,
    carrierRequired: false,
    exceptionText: mapped.notes.length ? mapped.notes.join("; ") : null,
    sourceType: "import",
    sourceAttribution: ATTRIBUTION,
    sourceUrl: `https://www.openstreetmap.org/${osmType}/${el.id}`,
    confidence: "osm",
    rawTags: tags,
    moderationStatus: "draft",
  };
}

export function mapOsmElements(
  elements: OsmElementLike[],
): OsmPolicyContributionDraft[] {
  const out: OsmPolicyContributionDraft[] = [];
  for (const el of elements) {
    const draft = osmElementToContributionDraft(el);
    if (draft) out.push(draft);
  }
  return out;
}
