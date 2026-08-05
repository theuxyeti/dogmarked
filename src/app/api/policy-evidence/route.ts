import { NextResponse } from "next/server";
import { z } from "zod";
import { publicApiError, logServerError } from "@/lib/api-errors";
import { isSupabaseConfigured } from "@/lib/utils";

const createOfficialEvidenceSchema = z.object({
  placeId: z.string().uuid(),
  url: z.string().url(),
  note: z.string().trim().max(2000).optional().nullable(),
  excerpt: z.string().trim().max(2000).optional().nullable(),
  sourceTitle: z.string().trim().max(300).optional().nullable(),
  reportId: z.string().uuid().optional().nullable(),
  isOfficial: z.boolean().default(true),
  kind: z.enum(["photo", "url", "note", "other"]).default("url"),
});

/**
 * POST official / retrieved policy source into policy_evidence.
 * Complements legacy /api/evidence (contribution-linked, licensing-focused).
 */
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

  const parsed = createOfficialEvidenceSchema.safeParse(body);
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

  const payload = parsed.data;
  const { data, error } = await supabase
    .from("policy_evidence")
    .insert({
      place_id: payload.placeId,
      contribution_id: null,
      report_id: payload.reportId ?? null,
      kind: payload.kind,
      url: payload.url,
      note: payload.note ?? null,
      excerpt: payload.excerpt ?? payload.note ?? null,
      source_title: payload.sourceTitle ?? null,
      is_official: payload.isOfficial,
      retrieved_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select(
      "id, place_id, url, note, excerpt, source_title, is_official, retrieved_at, report_id, created_at",
    )
    .single();

  if (error) {
    logServerError("policy-evidence.POST", error);
    return NextResponse.json(
      {
        error:
          error.code === "42P01" || error.message?.includes("column")
            ? "policy_evidence missing columns — apply migration 017."
            : publicApiError(error, "Could not save policy evidence."),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    evidence: {
      id: data.id,
      placeId: data.place_id,
      url: data.url,
      note: data.note,
      excerpt: data.excerpt,
      sourceTitle: data.source_title,
      isOfficial: data.is_official,
      retrievedAt: data.retrieved_at,
      reportId: data.report_id,
      createdAt: data.created_at,
    },
  });
}

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
    .from("policy_evidence")
    .select(
      "id, place_id, url, note, excerpt, source_title, is_official, retrieved_at, report_id, kind, created_at",
    )
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    logServerError("policy-evidence.GET", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not load policy evidence.") },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    evidence: (data ?? []).map((row) => ({
      id: row.id,
      placeId: row.place_id,
      url: row.url,
      note: row.note,
      excerpt: row.excerpt,
      sourceTitle: row.source_title,
      isOfficial: row.is_official,
      retrievedAt: row.retrieved_at,
      reportId: row.report_id,
      kind: row.kind,
      createdAt: row.created_at,
    })),
  });
}
