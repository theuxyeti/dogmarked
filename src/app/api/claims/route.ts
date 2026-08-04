import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/utils";

const createSchema = z.object({
  placeId: z.string().uuid(),
  businessName: z.string().trim().max(200).optional().nullable(),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  proofUrl: z.string().url().optional().nullable().or(z.literal("")),
  proofNote: z.string().trim().max(2000).optional().nullable(),
});

const reviewSchema = z.object({
  claimId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "revoked"]),
  reviewerNote: z.string().trim().max(1000).optional().nullable(),
});

/** Authenticated user submits a business claim (stub — no policy write grant). */
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

  const parsed = createSchema.safeParse(body);
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

  const { data, error } = await supabase
    .from("place_claims")
    .insert({
      place_id: parsed.data.placeId,
      claimant_id: user.id,
      business_name: parsed.data.businessName ?? null,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone ?? null,
      proof_url: parsed.data.proofUrl || null,
      proof_note: parsed.data.proofNote ?? null,
      status: "pending",
    })
    .select("id, status, created_at")
    .single();

  if (error) {
    const msg =
      error.code === "23505"
        ? "You already have a claim on this place."
        : error.message ?? "Could not create claim. Apply migration 011?";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    claim: data,
    message:
      "Claim submitted for review. Approval does not auto-change dog policy confidence.",
  });
}

/** Moderator list (pending by default) or review via PATCH-like body with action. */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const status = new URL(request.url).searchParams.get("status") ?? "pending";

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

  let query = supabase
    .from("place_claims")
    .select(
      "id, place_id, claimant_id, business_name, contact_email, contact_phone, proof_url, proof_note, status, created_at, places(name, slug)",
    )
    .order("created_at", { ascending: true })
    .limit(50);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Could not load claims. Apply migration 011?" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, claims: data ?? [] });
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(body);
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

  const { data, error } = await supabase.rpc("review_place_claim", {
    p_claim_id: parsed.data.claimId,
    p_status: parsed.data.status,
    p_reviewer_note: parsed.data.reviewerNote ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    claim: data,
    message: `Claim marked ${parsed.data.status}. Policy write access is still server-only.`,
  });
}
