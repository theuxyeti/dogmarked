import { NextResponse } from "next/server";

const throttle = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

export type AuthUser = { id: string; email?: string };

export async function requireDiscoveryUser(): Promise<
  | { user: AuthUser; error?: undefined }
  | { user?: undefined; error: NextResponse }
> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Sign in to discover places nearby." },
        { status: 401 },
      ),
    };
  }

  if (!allowUserRequest(user.id)) {
    return {
      error: NextResponse.json(
        { error: "Too many place searches. Wait a moment and try again." },
        { status: 429 },
      ),
    };
  }

  return { user: { id: user.id, email: user.email } };
}

function allowUserRequest(userId: string): boolean {
  const now = Date.now();
  const stamps = (throttle.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_PER_WINDOW) {
    throttle.set(userId, stamps);
    return false;
  }
  stamps.push(now);
  throttle.set(userId, stamps);
  return true;
}

export function parseLatLng(searchParams: URLSearchParams): {
  lat: number;
  lng: number;
} | null {
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
