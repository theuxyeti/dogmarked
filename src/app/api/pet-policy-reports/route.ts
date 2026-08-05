import { NextResponse } from "next/server";
import { publicApiError, logServerError } from "@/lib/api-errors";
import { deriveSummary } from "@/lib/policy/evidence";
import { mapReportRow, reportToInsert, type PetPolicyReportRow } from "@/lib/policy/report-mapper";
import { createPetPolicyReportSchema } from "@/lib/policy/schema";
import { isSupabaseConfigured } from "@/lib/utils";

/**
 * GET ?placeId= — list reports visible to the caller + derived public summary.
 * POST — create own structured trip/policy report.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const placeId = new URL(request.url).searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pet_policy_reports")
    .select("*")
    .eq("place_id", placeId)
    .order("visited_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logServerError("pet-policy-reports.GET", error);
    return NextResponse.json(
      {
        error:
          error.code === "42P01"
            ? "Pet policy reports table missing — apply migration 017."
            : publicApiError(error, "Could not load policy reports."),
      },
      { status: 400 },
    );
  }

  const reports = ((data ?? []) as PetPolicyReportRow[]).map(mapReportRow);

  const { data: evidenceRows } = await supabase
    .from("policy_evidence")
    .select("is_official, url, excerpt")
    .eq("place_id", placeId)
    .eq("is_official", true)
    .limit(20);

  const summary = deriveSummary(reports, {
    officialEvidence: (evidenceRows ?? []).map((e) => ({
      isOfficial: Boolean(e.is_official),
      url: (e.url as string | null) ?? null,
      excerpt: (e.excerpt as string | null) ?? null,
    })),
  });

  return NextResponse.json({
    ok: true,
    reports,
    summary,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPetPolicyReportSchema.safeParse(body);
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

  const insert = reportToInsert({
    ...parsed.data,
    userId: user.id,
  });

  const { data, error } = await supabase
    .from("pet_policy_reports")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    logServerError("pet-policy-reports.POST", error);
    return NextResponse.json(
      {
        error:
          error.code === "42P01"
            ? "Pet policy reports table missing — apply migration 017."
            : publicApiError(error, "Could not create policy report."),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    report: mapReportRow(data as PetPolicyReportRow),
  });
}
