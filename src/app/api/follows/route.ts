import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/utils";

const followSchema = z.object({
  targetType: z.enum(["user", "collection"]),
  targetId: z.string().uuid(),
});

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
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
    .from("follows")
    .select("id, follower_id, target_type, target_id, created_at")
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    follows: (data ?? []).map((row) => ({
      id: row.id,
      followerId: row.follower_id,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at,
    })),
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

  const parsed = followSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required to follow." }, { status: 401 });
  }

  if (parsed.data.targetType === "user" && parsed.data.targetId === user.id) {
    return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("follows")
    .upsert(
      {
        follower_id: user.id,
        target_type: parsed.data.targetType,
        target_id: parsed.data.targetId,
      },
      { onConflict: "follower_id,target_type,target_id" },
    )
    .select("id, target_type, target_id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    follow: data,
    message: "Following.",
  });
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId");
  const parsed = followSchema.safeParse({ targetType, targetId });
  if (!parsed.success) {
    return NextResponse.json({ error: "targetType and targetId required." }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("target_type", parsed.data.targetType)
    .eq("target_id", parsed.data.targetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Unfollowed." });
}
