import Link from "next/link";
import {
  planConflictResolution,
  sortModerationQueue,
  type ContributionForModeration,
  type PolicySnapshot,
} from "@/lib/moderation";
import { isSupabaseConfigured } from "@/lib/utils";

export const metadata = {
  title: "Moderation · Dogmarked",
  description: "Moderator queue for policy contributions.",
};

function mapContribution(row: Record<string, unknown>): ContributionForModeration {
  return {
    id: String(row.id),
    placeId: String(row.place_id),
    userId: String(row.user_id),
    moderationStatus: row.moderation_status as ContributionForModeration["moderationStatus"],
    dogStatus: String(row.dog_status),
    access: (row.access as string[]) ?? [],
    maxDogs: (row.max_dogs as number | null) ?? null,
    maxWeightKg: (row.max_weight_kg as number | null) ?? null,
    maxCombinedWeightKg: (row.max_combined_weight_kg as number | null) ?? null,
    smallDogsOnly: Boolean(row.small_dogs_only),
    carrierRequired: Boolean(row.carrier_required),
    leashRequired: Boolean(row.leash_required ?? true),
    advanceApprovalRequired: Boolean(row.advance_approval_required),
    feeType: String(row.fee_type ?? "unknown"),
    feeAmount: (row.fee_amount as number | null) ?? null,
    feeCurrency: (row.fee_currency as string | null) ?? "USD",
    exceptionText: (row.exception_text as string | null) ?? null,
    sourceType: String(row.source_type ?? "firsthand"),
    sourceUrl: (row.source_url as string | null) ?? null,
    observedAt: row.observed_at ? String(row.observed_at) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapPolicy(row: Record<string, unknown> | null): PolicySnapshot | null {
  if (!row) return null;
  return {
    dogStatus: String(row.dog_status),
    access: (row.access as string[]) ?? [],
    maxDogs: (row.max_dogs as number | null) ?? null,
    maxWeightKg: (row.max_weight_kg as number | null) ?? null,
    maxCombinedWeightKg: (row.max_combined_weight_kg as number | null) ?? null,
    smallDogsOnly: Boolean(row.small_dogs_only),
    carrierRequired: Boolean(row.carrier_required),
    leashRequired: Boolean(row.leash_required ?? true),
    advanceApprovalRequired: Boolean(row.advance_approval_required),
    feeType: String(row.fee_type ?? "unknown"),
    feeAmount: (row.fee_amount as number | null) ?? null,
    feeCurrency: (row.fee_currency as string | null) ?? "USD",
    exceptionText: (row.exception_text as string | null) ?? null,
  };
}

export default async function ModeratePage() {
  let queue: ContributionForModeration[] = [];
  let reports: Array<{ id: string; place_id: string; reason: string; note: string | null; status: string }> =
    [];
  const canonicalByPlace = new Map<string, PolicySnapshot>();
  const placeNames = new Map<string, string>();
  let accessNote = "Sign in as a moderator to load the live queue.";
  let isMod = false;

  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        accessNote = "Sign in required. Moderators see draft/in_review contributions.";
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        isMod = profile?.role === "moderator" || profile?.role === "admin";

        const { data: contribs, error } = await supabase
          .from("policy_contributions")
          .select("*")
          .in("moderation_status", ["draft", "in_review"])
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          accessNote = error.message;
        } else if (!isMod && (!contribs || contribs.length === 0)) {
          accessNote =
            "No own drafts in queue. Set profiles.role to moderator/admin to review all contributions.";
        } else {
          accessNote = isMod
            ? "Live queue from Supabase. Promote remains server-only."
            : "Showing your own draft/in_review contributions.";
          queue = sortModerationQueue((contribs ?? []).map((r) => mapContribution(r as Record<string, unknown>)));

          const placeIds = [...new Set(queue.map((q) => q.placeId))];
          if (placeIds.length) {
            const { data: places } = await supabase
              .from("places")
              .select("id, name")
              .in("id", placeIds);
            for (const p of places ?? []) {
              placeNames.set(String(p.id), String(p.name));
            }
            const { data: policies } = await supabase
              .from("dog_policies")
              .select("*")
              .in("place_id", placeIds);
            for (const pol of policies ?? []) {
              const mapped = mapPolicy(pol as Record<string, unknown>);
              if (mapped) canonicalByPlace.set(String(pol.place_id), mapped);
            }
          }
        }

        if (isMod) {
          const { data: reportRows } = await supabase
            .from("policy_reports")
            .select("id, place_id, reason, note, status")
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(30);
          reports = (reportRows as typeof reports) ?? [];
        }
      }
    } catch (err) {
      accessNote = err instanceof Error ? err.message : "Could not load moderation queue.";
    }
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <p className="font-display text-3xl text-teal-deep">Dogmarked</p>
        <h1 className="mt-2 text-xl font-medium text-ink">Moderation queue</h1>
        <p className="mt-1 text-sm text-muted">{accessNote}</p>
      </header>

      {reports.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-deep">
            Open reports
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {reports.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card/70 px-4 py-3 text-sm">
                <p className="font-medium text-ink">{r.reason.replaceAll("_", " ")}</p>
                <p className="text-muted">
                  Place {r.place_id.slice(0, 8)}…{r.note ? ` — ${r.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="flex flex-col gap-4">
        {queue.map((item) => {
          const canonical = canonicalByPlace.get(item.placeId) ?? null;
          const plan = canonical
            ? planConflictResolution(canonical, item)
            : {
                action: "promote" as const,
                summary: "No canonical policy yet — safe to promote as first version.",
                conflicts: [] as ReturnType<typeof planConflictResolution>["conflicts"],
              };
          return (
            <li key={item.id} className="rounded-2xl bg-sand/35 px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-ink">
                  {placeNames.get(item.placeId) ?? `Place ${item.placeId.slice(0, 8)}`}
                </p>
                <span className="text-xs uppercase tracking-wide text-teal-deep">
                  {item.moderationStatus}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {item.dogStatus.replace(/_/g, " ")} · source {item.sourceType}
              </p>
              <p className="mt-3 text-sm text-ink">
                Suggested: <strong>{plan.action}</strong> — {plan.summary}
              </p>
              {plan.conflicts.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                  {plan.conflicts.map((c) => (
                    <li key={c.field}>
                      {c.field}: {String(c.canonical)} → {String(c.incoming)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
        {queue.length === 0 ? (
          <li className="text-sm text-muted">Queue is empty.</li>
        ) : null}
      </ul>

      <p className="mt-10 text-sm text-muted">
        <Link href="/explore" className="text-teal-deep underline">
          Back to Explore
        </Link>
        {" · "}
        <Link href="/admin/imports" className="text-teal-deep underline">
          Imports
        </Link>
        {" · "}
        <Link href="/admin/merges" className="text-teal-deep underline">
          Merges
        </Link>
        {" · "}
        <Link href="/admin/claims" className="text-teal-deep underline">
          Claims
        </Link>
        {" · "}
        <Link href="/admin/partners" className="text-teal-deep underline">
          Partners
        </Link>
      </p>
    </main>
  );
}
