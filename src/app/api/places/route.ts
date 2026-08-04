import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_BBOX, getPlacesInBbox } from "@/lib/places/queries";
import { pointEwkt, slugifyPlaceName } from "@/lib/places/slug";
import { isSupabaseConfigured } from "@/lib/utils";

const createPlaceSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: z
    .enum(["park", "restaurant", "beach", "hotel", "cafe", "other"])
    .default("other"),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  countryCode: z.string().trim().length(2).default("US"),
  address: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  region: z.string().trim().max(120).optional().nullable(),
  postalCode: z.string().trim().max(32).optional().nullable(),
  sourceAttribution: z.string().trim().max(500).optional().nullable(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minLng = Number(searchParams.get("minLng") ?? DEFAULT_BBOX.minLng);
  const minLat = Number(searchParams.get("minLat") ?? DEFAULT_BBOX.minLat);
  const maxLng = Number(searchParams.get("maxLng") ?? DEFAULT_BBOX.maxLng);
  const maxLat = Number(searchParams.get("maxLat") ?? DEFAULT_BBOX.maxLat);

  if ([minLng, minLat, maxLng, maxLat].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "Invalid bbox" }, { status: 400 });
  }

  const places = await getPlacesInBbox({ minLng, minLat, maxLng, maxLat });
  return NextResponse.json({ places });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase is not configured. Creating places requires a connected project.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to create a place." },
      { status: 401 },
    );
  }

  const data = parsed.data;

  // Basic proximity duplicate check (~150m bbox + name similarity).
  const delta = 0.0015;
  const { data: nearby } = await supabase
    .from("places")
    .select("id, name, slug, lat, lng, city, category")
    .eq("status", "active")
    .gte("lat", data.lat - delta)
    .lte("lat", data.lat + delta)
    .gte("lng", data.lng - delta)
    .lte("lng", data.lng + delta)
    .limit(20);

  const normalizedName = data.name.toLowerCase().trim();
  const duplicate = (nearby ?? []).find((p) => {
    const existing = String(p.name).toLowerCase().trim();
    return existing === normalizedName || existing.includes(normalizedName) || normalizedName.includes(existing);
  });

  if (duplicate) {
    return NextResponse.json({
      ok: true,
      created: false,
      duplicate: true,
      place: {
        id: duplicate.id,
        name: duplicate.name,
        slug: duplicate.slug,
        lat: duplicate.lat,
        lng: duplicate.lng,
        city: duplicate.city,
        category: duplicate.category,
      },
      message: "A nearby place with a similar name already exists — using that record.",
    });
  }

  const baseSlug = slugifyPlaceName(data.name, data.city);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    slug = `${baseSlug}${suffix}`.slice(0, 80);

    const { data: place, error } = await supabase
      .from("places")
      .insert({
        name: data.name,
        slug,
        category: data.category,
        location: pointEwkt(data.lat, data.lng),
        lat: data.lat,
        lng: data.lng,
        country_code: data.countryCode.toUpperCase(),
        address_line1: data.address ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        postal_code: data.postalCode ?? null,
        address: {
          line1: data.address ?? null,
          city: data.city ?? null,
          region: data.region ?? null,
          postal_code: data.postalCode ?? null,
        },
        status: "active",
        source_type: "user",
        source_attribution:
          data.sourceAttribution ??
          "User-selected location via Dogmarked geocoding adapter (interactive selection).",
        created_by: user.id,
      })
      .select("id, name, slug, lat, lng, city, category")
      .single();

    if (!error && place) {
      return NextResponse.json({
        ok: true,
        created: true,
        duplicate: false,
        place,
        message: "Place created. You can now save it privately or publish a policy contribution.",
      });
    }

    if (error?.code !== "23505") {
      return NextResponse.json({ error: error?.message ?? "Failed to create place" }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Could not allocate a unique slug." }, { status: 409 });
}
