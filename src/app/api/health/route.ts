import { NextResponse } from "next/server";
import { isMapTilerConfigured, isSupabaseConfigured } from "@/lib/utils";

export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();
  let supabaseReachable = false;

  if (supabaseConfigured) {
    try {
      const { tryCreateServerClient } = await import("@/lib/supabase/server");
      const supabase = await tryCreateServerClient();
      if (supabase) {
        const { error } = await supabase.from("places").select("id").limit(1);
        supabaseReachable = !error;
      }
    } catch {
      supabaseReachable = false;
    }
  }

  return NextResponse.json({
    ok: true,
    supabase: supabaseConfigured && supabaseReachable,
    supabaseConfigured,
    maptiler: isMapTilerConfigured(),
    foursquareConfigured: Boolean(process.env.FOURSQUARE_API_KEY?.trim()),
    fsqDiscoveryEnabled: process.env.FSQ_DISCOVERY_ENABLED !== "false",
  });
}
