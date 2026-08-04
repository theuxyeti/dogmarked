import {
  planConflictResolution,
  sortModerationQueue,
  type ContributionForModeration,
  type PolicySnapshot,
} from "@/lib/moderation";

export const metadata = {
  title: "Moderation · Dogmarked",
  description: "Moderator queue for policy contributions.",
};

const FIXTURE_CANONICAL: PolicySnapshot = {
  dogStatus: "dogs_ok_with_restrictions",
  access: ["patio", "outdoors"],
  maxDogs: 2,
  maxWeightKg: 25,
  maxCombinedWeightKg: 40,
  smallDogsOnly: false,
  carrierRequired: false,
  leashRequired: true,
  advanceApprovalRequired: false,
  feeType: "none",
  feeAmount: null,
  feeCurrency: "USD",
  exceptionText: null,
};

const FIXTURE_QUEUE: ContributionForModeration[] = [
  {
    id: "c-1",
    placeId: "p-1",
    userId: "u-1",
    moderationStatus: "in_review",
    dogStatus: "dogs_welcome",
    access: ["patio", "outdoors", "indoors"],
    maxDogs: 1,
    maxWeightKg: 25,
    maxCombinedWeightKg: 25,
    smallDogsOnly: false,
    carrierRequired: false,
    leashRequired: true,
    advanceApprovalRequired: false,
    feeType: "none",
    feeAmount: null,
    feeCurrency: "USD",
    exceptionText: "Manager said indoors OK after 3pm",
    sourceType: "staff",
    sourceUrl: null,
    observedAt: "2026-07-12",
    createdAt: "2026-07-13T14:00:00.000Z",
  },
  {
    id: "c-2",
    placeId: "p-2",
    userId: "u-2",
    moderationStatus: "draft",
    dogStatus: "dogs_ok_outdoors",
    access: ["beach"],
    maxDogs: null,
    maxWeightKg: null,
    maxCombinedWeightKg: null,
    smallDogsOnly: false,
    carrierRequired: false,
    leashRequired: true,
    advanceApprovalRequired: false,
    feeType: "none",
    feeAmount: null,
    feeCurrency: "USD",
    exceptionText: null,
    sourceType: "firsthand",
    sourceUrl: null,
    observedAt: "2026-08-01",
    createdAt: "2026-08-01T18:20:00.000Z",
  },
];

/**
 * Moderator queue stub — fixture data until RLS role checks land.
 * Promote remains server-only via promote_policy_contribution / Edge Function.
 */
export default function ModeratePage() {
  const queue = sortModerationQueue(FIXTURE_QUEUE);

  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink,#1c2421)]">
          Dogmarked
        </p>
        <h1 className="mt-2 text-xl font-medium">Moderation queue</h1>
        <p className="mt-1 text-sm text-[var(--ink,#1c2421)]/65">
          Review contributions. Canonical policy updates only via protected
          server promote.
        </p>
      </header>

      <ul className="flex flex-col gap-4">
        {queue.map((item) => {
          const plan = planConflictResolution(FIXTURE_CANONICAL, item);
          return (
            <li
              key={item.id}
              className="rounded-2xl bg-[var(--sand,#e8dfd2)]/35 px-4 py-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-[var(--ink,#1c2421)]">
                  {item.dogStatus.replace(/_/g, " ")}
                </p>
                <span className="text-xs uppercase tracking-wide text-[var(--teal,#0f5c56)]">
                  {item.moderationStatus}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--ink,#1c2421)]/65">
                Place {item.placeId.slice(0, 8)} · source {item.sourceType}
              </p>
              <p className="mt-3 text-sm text-[var(--ink,#1c2421)]">
                Suggested: <strong>{plan.action}</strong> — {plan.summary}
              </p>
              {plan.conflicts.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-xs text-[var(--ink,#1c2421)]/60">
                  {plan.conflicts.map((c) => (
                    <li key={c.field}>
                      {c.field}: {String(c.canonical)} → {String(c.incoming)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled
                  className="min-h-11 rounded-full bg-[var(--teal,#0f5c56)] px-4 text-sm text-white opacity-50"
                  title="Wire to promote RPC"
                >
                  Promote
                </button>
                <button
                  type="button"
                  disabled
                  className="min-h-11 rounded-full bg-[var(--ink,#1c2421)]/10 px-4 text-sm opacity-50"
                >
                  Reject
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
