import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/utils";

const idSchema = z.string().uuid();

/**
 * Affiliate click hop: record attribution then 302 to the partner URL.
 * Fail-open on logging errors so booking UX is not blocked.
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
    const { data, error } = await supabase.rpc("record_affiliate_click", {
      p_link_id: linkId,
      p_referrer: referrer,
      p_user_agent: userAgent,
    });

    if (!error && typeof data === "string" && data.startsWith("http")) {
      return NextResponse.redirect(data, 302);
    }

    // Fallback: resolve active link directly if RPC unavailable / failed.
    const { data: link } = await supabase
      .from("affiliate_links")
      .select("url")
      .eq("id", linkId)
      .eq("is_active", true)
      .maybeSingle();

    if (link?.url && String(link.url).startsWith("http")) {
      return NextResponse.redirect(String(link.url), 302);
    }
  } catch {
    // fall through
  }

  return NextResponse.redirect(new URL("/", request.url), 302);
}
