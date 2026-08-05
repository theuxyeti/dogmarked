import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError, publicApiError } from "@/lib/api-errors";
import { requireDiscoveryUser } from "@/lib/discovery/auth";
import { decorateCandidatesWithDogmarked } from "@/lib/discovery/decorate";
import { getDiscoveryAvailability } from "@/lib/discovery/usage";
import { getDiscoveryProvider } from "@/lib/places/providers";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  address: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
  const auth = await requireDiscoveryUser();
  if (auth.error) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid place resolution input." }, { status: 400 });
  }

  const discovery = await getDiscoveryAvailability();
  if (!discovery.nearby) {
    return NextResponse.json({
      candidate: null,
      message: discovery.reason ?? "Discovery unavailable.",
    });
  }

  const provider = getDiscoveryProvider();
  if (!provider) {
    return NextResponse.json({ candidate: null, message: "Provider not configured." });
  }

  try {
    const match = await provider.resolveCandidate(parsed.data);
    if (!match) return NextResponse.json({ candidate: null });
    const [decorated] = await decorateCandidatesWithDogmarked([match], auth.user.id);
    return NextResponse.json({ candidate: decorated ?? match });
  } catch (err) {
    logServerError("discovery.resolve", err);
    return NextResponse.json(
      {
        candidate: null,
        error: publicApiError(err instanceof Error ? err : null, "Could not resolve place."),
      },
      { status: 502 },
    );
  }
}
