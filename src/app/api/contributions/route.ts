import { NextResponse } from "next/server";
import { z } from "zod";
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
  sourceType: z
    .enum(["firsthand", "official_website", "staff", "signage", "other"])
    .optional()
    .nullable(),
  sourceUrl: z.string().url().optional().nullable().or(z.literal("")),
  promote: z.boolean().optional(),
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
      source_type: payload.sourceType ?? "firsthand",
      source_url: payload.sourceUrl || null,
      moderation_status: moderationStatus,
      observed_at: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !contribution) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create contribution" },
      { status: 400 },
    );
  }

  let promoted = false;
  let promoteError: string | null = null;

  if (payload.promote) {
    const { error: rpcError } = await supabase.rpc("promote_policy_contribution", {
      contribution_id: contribution.id,
    });

    if (rpcError) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const { error: adminRpcError } = await admin.rpc("promote_policy_contribution", {
          contribution_id: contribution.id,
        });
        if (adminRpcError) {
          promoteError = adminRpcError.message;
        } else {
          promoted = true;
        }
      } catch (err) {
        promoteError = rpcError.message || String(err);
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
        ? `Contribution saved; promote skipped: ${promoteError}`
        : "Contribution saved as draft.",
  });
}
