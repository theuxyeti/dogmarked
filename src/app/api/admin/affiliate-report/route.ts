import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/utils";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/**
 * Moderator-only partner click rollup.
 * Does not touch policy confidence or dog_policies.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    days: url.searchParams.get("days") ?? 30,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["moderator", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Moderator access required." }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("partner_click_report", {
    p_days: parsed.data.days,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Report query failed. Apply migration 008?" },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as Array<{
    day: string;
    network: string | null;
    place_id: string;
    place_name: string;
    place_slug: string;
    clicks: number | string;
  }>;

  const report = rows.map((r) => ({
    day: String(r.day).slice(0, 10),
    network: r.network ?? "unspecified",
    placeId: String(r.place_id),
    placeName: String(r.place_name),
    placeSlug: String(r.place_slug),
    clicks: Number(r.clicks) || 0,
  }));

  const totalClicks = report.reduce((n, r) => n + r.clicks, 0);
  const byNetwork = new Map<string, number>();
  for (const r of report) {
    byNetwork.set(r.network, (byNetwork.get(r.network) ?? 0) + r.clicks);
  }

  return NextResponse.json({
    days: parsed.data.days,
    totalClicks,
    networks: [...byNetwork.entries()]
      .map(([network, clicks]) => ({ network, clicks }))
      .sort((a, b) => b.clicks - a.clicks),
    rows: report,
  });
}
