import { NextResponse } from "next/server";
import { z } from "zod";
import { isBookingPropertyUrl, isDisplayablePlaceLink, mapPlaceLinkRow, type PlaceLinkRow } from "@/lib/place-links";
import { isSupabaseConfigured } from "@/lib/utils";

const idSchema = z.string().uuid();

/**
 * Place-link click hop: record instrumentation then 302 to the destination.
 * Works for non-affiliate verified links (isAffiliate=false); fail-open on log errors.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const idParsed = idSchema.safeParse(url.searchParams.get("id"));
  if (!idParsed.success) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const linkId = idParsed.data;
  const referrer = request.headers.get("referer");
  const userAgent = request.headers.get("user-agent");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_place_link_click", {
      p_link_id: linkId,
      p_referrer: referrer,
      p_user_agent: userAgent,
    });

    if (!error && typeof data === "string" && data.startsWith("http")) {
      if (destinationAllowed(data)) {
        return NextResponse.redirect(data, 302);
      }
    }

    // Fallback: resolve verified active link directly if RPC unavailable / failed.
    const { data: link } = await supabase
      .from("place_links")
      .select("*")
      .eq("id", linkId)
      .eq("is_active", true)
      .eq("is_verified", true)
      .maybeSingle();

    if (link) {
      const mapped = mapPlaceLinkRow(link as PlaceLinkRow);
      if (isDisplayablePlaceLink(mapped) && destinationAllowed(mapped.url)) {
        return NextResponse.redirect(mapped.url, 302);
      }
    }
  } catch {
    // fall through
  }

  return NextResponse.redirect(new URL("/", request.url), 302);
}

function destinationAllowed(dest: string): boolean {
  if (!dest.startsWith("http")) return false;
  // Never hop to Booking search pages even if a bad row slipped in.
  try {
    const host = new URL(dest).hostname.toLowerCase();
    if (host === "booking.com" || host.endsWith(".booking.com")) {
      return isBookingPropertyUrl(dest);
    }
  } catch {
    return false;
  }
  return true;
}
