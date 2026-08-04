import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/utils";

export async function POST(request: Request) {
  const { origin } = new URL(request.url);

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(`${origin}/explore`, { status: 303 });
}

export async function GET(request: Request) {
  return POST(request);
}
