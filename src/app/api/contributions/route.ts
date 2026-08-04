import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";
import { isSupabaseConfigured } from "@/lib/utils";

const contributionSchema = z.object({
  placeId: z.string().min(1),
  dogStatus: z.enum([
    "dogs_welcome",
    "dogs_ok_outdoors",
    "dogs_ok_with_restrictions",
    "ask_first",
    "service_animals_only",
    "no_dogs",
  ]),
  access: z.array(z.string()).default([]),
  maxDogs: z.number().int().positive().nullable().optional(),
  maxWeightKg: z.number().positive().nullable().optional(),
  maxCombinedWeightKg: z.number().positive().nullable().optional(),
  smallDogsOnly: z.boolean().optional(),
  carrierRequired: z.boolean().optional(),
  leashRequired: z.boolean().optional(),
  advanceApprovalRequired: z.boolean().optional(),
  feeType: z
    .enum(["none", "flat", "per_dog", "per_night", "deposit", "unknown"])
    .optional(),
  feeAmount: z.number().nullable().optional(),
  feeCurrency: z.string().optional().nullable(),
  exceptionText: z.string().max(2000).nullable().optional(),
  seasonalNotes: z.string().max(2000).nullable().optional(),
  seasonalStartMonth: z.number().int().min(1).max(12).nullable().optional(),
  seasonalEndMonth: z.number().int().min(1).max(12).nullable().optional(),
  sourceType: z
    .enum(["firsthand", "official_website", "staff", "signage", "other"])
    .optional()
    .nullable(),
  sourceUrl: z.string().url().optional().nullable().or(z.literal("")),
  promote: z.boolean().optional(),
  evidenceUrl: z.string().url().optional().nullable().or(z.literal("")),
  evidenceNote: z.string().max(2000).optional().nullable(),
  evidenceAttribution: z.string().max(500).optional().nullable(),
  evidenceLicense: z.string().max(200).optional().nullable(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase is not configured. Contributions require a connected project.",
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

  const parsed = contributionSchema.safeParse(body);
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
      { error: "Sign in required to submit a contribution." },
      { status: 401 },
    );
  }

  // Ensure profiles row exists (migration 012 trigger + RPC). FK failures look like RLS.
  const { error: profileError } = await supabase.rpc("ensure_own_profile");
  if (profileError) {
    // Fallback insert if RPC not applied yet
    const { error: insertProfileError } = await supabase.from("profiles").upsert({
      id: user.id,
      handle: `user${user.id.replace(/-/g, "").slice(0, 12)}`,
      display_name: user.email?.split("@")[0] ?? "user",
      role: "user",
    });
    if (insertProfileError) {
      logServerError("contributions.ensure_profile", insertProfileError);
      return NextResponse.json(
        {
          error: publicApiError(
            insertProfileError,
            "Could not prepare your profile. Try signing out and back in.",
          ),
        },
        { status: 400 },
      );
    }
  }

  const payload = parsed.data;
  // RLS only allows client insert as draft/in_review; promote RPC publishes.
  const moderationStatus = payload.promote ? "in_review" : "draft";

  const { data: contribution, error } = await supabase
    .from("policy_contributions")
    .insert({
      place_id: payload.placeId,
      user_id: user.id,
      dog_status: payload.dogStatus,
      access: payload.access,
      max_dogs: payload.maxDogs ?? null,
      max_weight_kg: payload.maxWeightKg ?? null,
      max_combined_weight_kg: payload.maxCombinedWeightKg ?? null,
      small_dogs_only: payload.smallDogsOnly ?? false,
      carrier_required: payload.carrierRequired ?? false,
      leash_required: payload.leashRequired ?? true,
      advance_approval_required: payload.advanceApprovalRequired ?? false,
      fee_type: payload.feeType ?? "unknown",
      fee_amount: payload.feeAmount ?? null,
      fee_currency: payload.feeCurrency ?? "USD",
      exception_text: payload.exceptionText ?? null,
      seasonal_notes: payload.seasonalNotes ?? null,
      seasonal_start_month: payload.seasonalStartMonth ?? null,
      seasonal_end_month: payload.seasonalEndMonth ?? null,
      source_type: payload.sourceType ?? "firsthand",
      source_url: payload.sourceUrl || null,
      moderation_status: moderationStatus,
      observed_at: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !contribution) {
    logServerError("contributions.insert", error);
    return NextResponse.json(
      {
        error: publicApiError(
          error,
          "Could not save your contribution. Please try again.",
        ),
      },
      { status: 400 },
    );
  }

  if (payload.evidenceUrl || payload.evidenceNote) {
    let photoId: string | null = null;
    if (payload.evidenceUrl) {
      const { data: photo } = await supabase
        .from("place_photos")
        .insert({
          place_id: payload.placeId,
          uploaded_by: user.id,
          source_type: "user_upload",
          source_url: payload.evidenceUrl,
          attribution_text: payload.evidenceAttribution ?? null,
          license: payload.evidenceLicense ?? null,
          storage_permission: "link_only",
          storage_path: null,
          caption: payload.evidenceNote ?? null,
          is_evidence: true,
        })
        .select("id")
        .maybeSingle();
      photoId = photo?.id ?? null;
    }
    await supabase.from("policy_evidence").insert({
      place_id: payload.placeId,
      contribution_id: contribution.id,
      photo_id: photoId,
      kind: payload.evidenceUrl ? "url" : "note",
      url: payload.evidenceUrl || null,
      note: payload.evidenceNote ?? null,
      created_by: user.id,
    });
  }

  let promoted = false;
  let promoteError: string | null = null;

  if (payload.promote) {
    const { error: rpcError } = await supabase.rpc("promote_policy_contribution", {
      contribution_id: contribution.id,
    });

    if (rpcError) {
      logServerError("contributions.promote", rpcError);
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const { error: adminRpcError } = await admin.rpc("promote_policy_contribution", {
          contribution_id: contribution.id,
        });
        if (adminRpcError) {
          logServerError("contributions.promote_admin", adminRpcError);
          promoteError = "saved_pending_review";
        } else {
          promoted = true;
        }
      } catch (err) {
        logServerError("contributions.promote_admin", err);
        promoteError = "saved_pending_review";
      }
    } else {
      promoted = true;
    }
  }

  return NextResponse.json({
    ok: true,
    contributionId: contribution.id,
    promoted,
    message: promoted
      ? "Contribution submitted and promoted to canonical policy."
      : promoteError
        ? "Contribution saved for review. Canonical policy updates after moderation."
        : "Contribution saved as draft.",
  });
}
