/**
 * Deno Edge Function stub: promote a policy contribution to canonical policy.
 *
 * Prefers the Postgres RPC `promote_policy_contribution` (see migration
 * `20260304120200_rls_and_promote.sql`) so clients never write dog_policies
 * directly.
 *
 * Deploy: `supabase functions deploy promote-policy`
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (set via CLI / dashboard — never commit)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as {
      contributionId?: string;
      actorId?: string;
    };

    if (!body.contributionId) {
      return json({ error: "contributionId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json(
        {
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
          hint: "Configure via `supabase secrets set` — do not hardcode.",
        },
        500,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // RPC signature from 20260304120200_rls_and_promote.sql:
    // promote_policy_contribution(contribution_id uuid) → dog_policies
    // Service role bypasses auth.uid() checks inside SECURITY DEFINER — prefer
    // calling as the moderating user JWT when available.
    const { data, error } = await admin.rpc("promote_policy_contribution", {
      contribution_id: body.contributionId,
    });

    if (error) {
      return json(
        {
          error: error.message,
          hint:
            "Ensure public.promote_policy_contribution(contribution_id uuid) exists. " +
            "Call with a user JWT (moderator/owner) when auth.uid() is required inside the RPC.",
          actorIdIgnored: body.actorId ?? null,
        },
        400,
      );
    }

    return json({ ok: true, result: data ?? null });
  } catch (err) {
    return json(
      {
        error: err instanceof Error ? err.message : "Unexpected error",
      },
      500,
    );
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Deno global typing for editors that are not Deno-aware.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
