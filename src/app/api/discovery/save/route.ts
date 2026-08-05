import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";
import { requireDiscoveryUser } from "@/lib/discovery/auth";
import { DOG_BADGE_IDS, categoryToDb, type MvpCategoryId } from "@/lib/mvp/taxonomy";
import { pointEwkt, slugifyPlaceName } from "@/lib/places/slug";
import { isSupabaseConfigured } from "@/lib/utils";

const mvpCategories = [
  "hotel",
  "food_drink",
  "beach",
  "park",
  "attraction",
  "landmark",
  "shopping",
  "transport",
  "pet_service",
  "other",
] as const;

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  category: z.enum(mvpCategories).default("other"),
  status: z.enum(["want_to_go", "been_there"]).default("want_to_go"),
  visibility: z.enum(["private", "public"]).default("private"),
  note: z.string().trim().max(2000).optional().nullable(),
  dogBadges: z.array(z.string()).max(20).optional().default([]),
  formattedAddress: z.string().trim().max(400).optional().nullable(),
  locality: z.string().trim().max(120).optional().nullable(),
  region: z.string().trim().max(120).optional().nullable(),
  countryCode: z.string().trim().length(2).optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(64).optional().nullable(),
  provider: z.enum(["foursquare", "maptiler", "custom"]).default("custom"),
  externalId: z.string().trim().max(128).optional().nullable(),
  attribution: z.string().trim().max(500).optional().nullable(),
  details: z.record(z.string(), z.unknown()).optional().nullable(),
  photoRefs: z.array(z.unknown()).optional().nullable(),
  tips: z.array(z.unknown()).optional().nullable(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Saving requires a connected project." }, { status: 503 });
  }

  const auth = await requireDiscoveryUser();
  if (auth.error) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the place details and try again." }, { status: 400 });
  }

  const data = parsed.data;
  const dogBadges = (data.dogBadges ?? []).filter((b) => DOG_BADGE_IDS.has(b as never));
  const dbCategory = categoryToDb(data.category as MvpCategoryId);
  const country = (data.countryCode ?? "US").toUpperCase();

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  try {
    let placeId: string | null = null;
    let slug: string | null = null;
    let created = false;

    if (data.provider !== "custom" && data.externalId) {
      const { data: ref } = await supabase
        .from("external_place_refs")
        .select("place_id")
        .eq("provider", data.provider)
        .eq("external_id", data.externalId)
        .maybeSingle();
      if (ref?.place_id) {
        placeId = String(ref.place_id);
        const { data: existing } = await supabase
          .from("places")
          .select("id, slug")
          .eq("id", placeId)
          .maybeSingle();
        slug = existing?.slug ? String(existing.slug) : null;
      }
    }

    if (!placeId) {
      // Name + proximity fallback
      const delta = 0.0015;
      const { data: nearby } = await supabase
        .from("places")
        .select("id, name, slug, lat, lng")
        .eq("status", "active")
        .gte("lat", data.latitude - delta)
        .lte("lat", data.latitude + delta)
        .gte("lng", data.longitude - delta)
        .lte("lng", data.longitude + delta)
        .limit(20);

      const nameNorm = data.name.toLowerCase().trim();
      const dup = (nearby ?? []).find((p) => {
        const n = String(p.name).toLowerCase().trim();
        return n === nameNorm || n.includes(nameNorm) || nameNorm.includes(n);
      });

      if (dup) {
        placeId = String(dup.id);
        slug = String(dup.slug);
      }
    }

    if (!placeId) {
      const baseSlug = slugifyPlaceName(data.name, data.locality ?? undefined);
      let attemptSlug = baseSlug;
      for (let attempt = 0; attempt < 5; attempt++) {
        attemptSlug =
          attempt === 0
            ? baseSlug
            : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 80);
        const { data: place, error } = await supabase
          .from("places")
          .insert({
            name: data.name,
            slug: attemptSlug,
            category: dbCategory,
            location: pointEwkt(data.latitude, data.longitude),
            lat: data.latitude,
            lng: data.longitude,
            country_code: country,
            address_line1: data.formattedAddress ?? null,
            city: data.locality ?? null,
            region: data.region ?? null,
            website: data.website ?? null,
            phone: data.phone ?? null,
            status: "active",
            source_type: data.provider === "custom" ? "user" : "import",
            source_attribution:
              data.attribution ??
              (data.provider === "foursquare"
                ? "Place data © Foursquare"
                : "User-selected location"),
            created_by: auth.user.id,
          })
          .select("id, slug")
          .single();

        if (!error && place) {
          placeId = String(place.id);
          slug = String(place.slug);
          created = true;
          break;
        }
        if (error?.code !== "23505") {
          logServerError("discovery.save.place", error);
          return NextResponse.json(
            { error: publicApiError(error, "Could not create that place.") },
            { status: 400 },
          );
        }
      }
    }

    if (!placeId) {
      return NextResponse.json({ error: "Could not allocate a place record." }, { status: 409 });
    }

    // external_place_refs + place_provider_cache: server/service-role writes only
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();

      if (data.provider !== "custom" && data.externalId) {
        await admin.from("external_place_refs").upsert(
          {
            place_id: placeId,
            provider: data.provider,
            external_id: data.externalId,
            name: data.name,
            category: dbCategory,
            lat: data.latitude,
            lng: data.longitude,
            country_code: country,
            formatted_address: data.formattedAddress ?? null,
            attribution: data.attribution ?? null,
            raw_normalized: {
              name: data.name,
              website: data.website ?? null,
              phone: data.phone ?? null,
            },
          },
          { onConflict: "provider,external_id" },
        );
      }

      if (data.details || data.photoRefs || data.tips) {
        const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
        await admin.from("place_provider_cache").upsert(
          {
            place_id: placeId,
            provider: data.provider === "custom" ? "dogmarked" : data.provider,
            details_json: data.details ?? {},
            photo_refs_json: data.photoRefs ?? [],
            tips_json: data.tips ?? [],
            attribution_json: { text: data.attribution ?? null },
            pricing_tier: "cached",
            fetched_at: new Date().toISOString(),
            expires_at: expires,
          },
          { onConflict: "place_id,provider" },
        );
      }
    } catch (err) {
      logServerError("discovery.save.refs", err);
      // Non-fatal — save can still succeed without cache/ref when admin key missing
    }

    const { error: saveErr } = await supabase.from("user_place_saves").upsert(
      {
        user_id: auth.user.id,
        place_id: placeId,
        status: data.status,
        visibility: data.visibility,
        private_notes: data.note || null,
        dog_badges: dogBadges,
      },
      { onConflict: "user_id,place_id" },
    );

    if (saveErr) {
      logServerError("discovery.save.save", saveErr);
      return NextResponse.json(
        { error: publicApiError(saveErr, "Could not save to your map.") },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      created,
      place: { id: placeId, slug, name: data.name },
      message: "Saved to your map.",
    });
  } catch (err) {
    logServerError("discovery.save", err);
    return NextResponse.json(
      { error: publicApiError(err instanceof Error ? err : null, "Could not save place.") },
      { status: 500 },
    );
  }
}
