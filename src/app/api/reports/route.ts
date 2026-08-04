import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/utils";

const reportSchema = z.object({
  placeId: z.string().uuid(),
  reason: z
    .enum(["incorrect_policy", "closed", "duplicate", "spam", "other"])
    .default("incorrect_policy"),
  note: z.string().trim().max(2000).optional().nullable(),
});

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

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required to report." }, { status: 401 });
  }

  const { error } = await supabase.from("policy_reports").insert({
    place_id: parsed.data.placeId,
    reporter_id: user.id,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
    status: "open",
  });

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message.includes("policy_reports") || error.code === "42P01"
            ? "Reports table missing — apply migration 20260304120600_policy_reports.sql."
            : error.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Report filed. Moderators can review it — private notes were not shared.",
  });
}
