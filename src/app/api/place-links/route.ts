import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";
import {
  bookingFlags,
  defaultLabelForProvider,
  mapPlaceLinkRow,
  validateBookingPropertyUrl,
  validateOfficialUrl,
  visiblePlaceLinks,
  type PlaceLinkProvider,
  type PlaceLinkRow,
} from "@/lib/place-links";
import { isSupabaseConfigured } from "@/lib/utils";

const placeIdSchema = z.string().uuid();

const createSchema = z.object({
  placeId: z.string().uuid(),
  provider: z.enum(["official", "booking"]),
  url: z.string().trim().min(1).max(2000),
  label: z.string().trim().max(120).optional().nullable(),
  externalPropertyId: z.string().trim().max(200).optional().nullable(),
  matchConfidence: z.number().min(0).max(1).optional().nullable(),
});

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Place links aren’t available yet." },
      { status: 503 },
    );
  }

  const placeIdParsed = placeIdSchema.safeParse(
    new URL(request.url).searchParams.get("placeId"),
  );
  if (!placeIdParsed.success) {
    return NextResponse.json({ error: "A valid placeId is required." }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("place_links")
    .select("*")
    .eq("place_id", placeIdParsed.data)
    .eq("is_active", true)
    .eq("is_verified", true)
    .order("provider", { ascending: true });

  if (error) {
    logServerError("place-links.GET", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not load place links.") },
      { status: 400 },
    );
  }

  const links = visiblePlaceLinks(
    (data ?? []).map((row) => mapPlaceLinkRow(row as PlaceLinkRow)),
  );

  return NextResponse.json({ ok: true, links });
}

/**
 * Add a verified non-affiliate official or Booking.com property link.
 * Server validates Booking URLs so search pages are never marked verified.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Saving place links requires a connected project." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the link details and try again." }, { status: 400 });
  }

  const flags = bookingFlags();
  const { placeId, provider, label, matchConfidence } = parsed.data;

  if (provider === "booking" && !flags.linksEnabled) {
    return NextResponse.json(
      { error: "Booking links are turned off right now." },
      { status: 403 },
    );
  }

  let url: string;
  let externalPropertyId = parsed.data.externalPropertyId ?? undefined;

  if (provider === "booking") {
    const booking = validateBookingPropertyUrl(parsed.data.url);
    if (!booking.ok) {
      return NextResponse.json({ error: booking.reason }, { status: 400 });
    }
    url = booking.url;
    externalPropertyId = externalPropertyId ?? booking.externalPropertyId;
  } else {
    const official = validateOfficialUrl(parsed.data.url);
    if (!official.ok) {
      return NextResponse.json({ error: official.reason }, { status: 400 });
    }
    url = official.url;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to add a place link." }, { status: 401 });
  }

  try {
    await supabase.rpc("ensure_own_profile");
  } catch {
    // migration 012 may be missing in some envs
  }

  const resolvedLabel =
    label?.trim() || defaultLabelForProvider(provider as PlaceLinkProvider);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("place_links")
    .insert({
      place_id: placeId,
      provider,
      url,
      label: resolvedLabel,
      external_property_id: externalPropertyId ?? null,
      is_affiliate: false,
      is_verified: true,
      match_confidence: matchConfidence ?? null,
      verified_at: now,
      is_active: true,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    logServerError("place-links.POST", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not save that place link.") },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    link: mapPlaceLinkRow(data as PlaceLinkRow),
  });
}
