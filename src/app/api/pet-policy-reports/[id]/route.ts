import { NextResponse } from "next/server";
import { publicApiError, logServerError } from "@/lib/api-errors";
import { mapReportRow, type PetPolicyReportRow } from "@/lib/policy/report-mapper";
import { updatePetPolicyReportSchema } from "@/lib/policy/schema";
import { isSupabaseConfigured } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH / DELETE own structured pet policy report.
 */
export async function PATCH(request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updatePetPolicyReportSchema.safeParse(body);
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

  const patch = parsed.data;
  const update: Record<string, unknown> = {};
  if (patch.petIds !== undefined) update.pet_ids = patch.petIds;
  if (patch.visitedOn !== undefined) update.visited_on = patch.visitedOn;
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if (patch.overallStatus !== undefined) update.overall_status = patch.overallStatus;
  if (patch.allowedSizes !== undefined) update.allowed_sizes = patch.allowedSizes;
  if (patch.weightLimitLb !== undefined) update.weight_limit_lb = patch.weightLimitLb;
  if (patch.maxDogs !== undefined) update.max_dogs = patch.maxDogs;
  if (patch.areas !== undefined) update.areas = patch.areas;
  if (patch.rules !== undefined) update.rules = patch.rules;
  if (patch.fee !== undefined) update.fee = patch.fee;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.evidenceType !== undefined) update.evidence_type = patch.evidenceType;
  if (patch.evidenceUrl !== undefined) update.evidence_url = patch.evidenceUrl;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pet_policy_reports")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    logServerError("pet-policy-reports.PATCH", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not update policy report.") },
      { status: 400 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Report not found or you do not own it." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    report: mapReportRow(data as PetPolicyReportRow),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("pet_policy_reports")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logServerError("pet-policy-reports.DELETE", error);
    return NextResponse.json(
      { error: publicApiError(error, "Could not delete policy report.") },
      { status: 400 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Report not found or you do not own it." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, deletedId: data.id });
}
