import { logServerError } from "@/lib/api-errors";
import { normalizeFoursquareApiKey } from "@/lib/discovery/fsq-key";

export type DiscoveryEndpoint =
  | "nearby"
  | "search"
  | "resolve"
  | "details"
  | "photos"
  | "tips";

export type UsageKind = "discovery" | "enrichment";

function envFlag(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true" || v === "yes";
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envFloat(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function fsqFlags() {
  return {
    discoveryEnabled: envFlag("FSQ_DISCOVERY_ENABLED", true),
    enrichmentEnabled: envFlag("FSQ_ENRICHMENT_ENABLED", true),
    photosEnabled: envFlag("FSQ_PHOTOS_ENABLED", true),
    tipsEnabled: envFlag("FSQ_TIPS_ENABLED", true),
    discoveryCallLimit: envInt("FSQ_MONTHLY_DISCOVERY_CALL_LIMIT", 1000),
    enrichmentBudgetUsd: envFloat("FSQ_MONTHLY_ENRICHMENT_BUDGET_USD", 25),
    /** Rough USD estimates — verify against Foursquare dashboard. */
    costDetailsUsd: envFloat("FSQ_COST_DETAILS_USD", 0.05),
    costPhotosUsd: envFloat("FSQ_COST_PHOTOS_USD", 0.05),
    costTipsUsd: envFloat("FSQ_COST_TIPS_USD", 0.05),
  };
}

function billingMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function kindFor(endpoint: DiscoveryEndpoint): UsageKind {
  return endpoint === "nearby" || endpoint === "search" || endpoint === "resolve"
    ? "discovery"
    : "enrichment";
}

function estimatedCostUsd(endpoint: DiscoveryEndpoint): number {
  const f = fsqFlags();
  if (endpoint === "details") return f.costDetailsUsd;
  if (endpoint === "photos") return f.costPhotosUsd;
  if (endpoint === "tips") return f.costTipsUsd;
  return 0;
}

export type EnrichmentAvailability = {
  details: boolean;
  /** Premium detail fields (hours, tel, website extras) */
  premiumDetails: boolean;
  photos: boolean;
  tips: boolean;
};

export type DiscoveryAvailability = {
  nearby: boolean;
  reason?: string;
};

async function admin() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/** In-memory fallback when service role / table unavailable (dev). */
const memCounts = new Map<string, { discovery: number; enrichmentUsd: number }>();

function memKey(): string {
  return `fsq:${billingMonth()}`;
}

async function readUsage(): Promise<{ discovery: number; enrichmentUsd: number }> {
  const month = billingMonth();
  const client = await admin();
  if (!client) {
    return memCounts.get(memKey()) ?? { discovery: 0, enrichmentUsd: 0 };
  }
  try {
    const { data, error } = await client
      .from("external_api_usage")
      .select("endpoint, request_count, estimated_cost_usd")
      .eq("provider", "foursquare")
      .eq("billing_month", month);
    if (error || !data) {
      return memCounts.get(memKey()) ?? { discovery: 0, enrichmentUsd: 0 };
    }
    let discovery = 0;
    let enrichmentUsd = 0;
    for (const row of data) {
      const ep = String(row.endpoint);
      const count = Number(row.request_count) || 0;
      const cost = Number(row.estimated_cost_usd) || 0;
      if (ep === "nearby" || ep === "search" || ep === "resolve") {
        discovery += count;
      } else {
        enrichmentUsd += cost;
      }
    }
    return { discovery, enrichmentUsd };
  } catch (err) {
    logServerError("discovery.usage.read", err);
    return memCounts.get(memKey()) ?? { discovery: 0, enrichmentUsd: 0 };
  }
}

export async function recordFsqUsage(endpoint: DiscoveryEndpoint): Promise<void> {
  const month = billingMonth();
  const cost = estimatedCostUsd(endpoint);
  const key = memKey();
  const mem = memCounts.get(key) ?? { discovery: 0, enrichmentUsd: 0 };
  if (kindFor(endpoint) === "discovery") mem.discovery += 1;
  else mem.enrichmentUsd += cost;
  memCounts.set(key, mem);

  const client = await admin();
  if (!client) return;

  try {
    const { data: existing } = await client
      .from("external_api_usage")
      .select("id, request_count, estimated_cost_usd")
      .eq("provider", "foursquare")
      .eq("endpoint", endpoint)
      .eq("billing_month", month)
      .maybeSingle();

    if (existing?.id) {
      await client
        .from("external_api_usage")
        .update({
          request_count: (Number(existing.request_count) || 0) + 1,
          estimated_cost_usd: (Number(existing.estimated_cost_usd) || 0) + cost,
          last_requested_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await client.from("external_api_usage").insert({
        provider: "foursquare",
        endpoint,
        pricing_tier: kindFor(endpoint) === "enrichment" ? "premium_est" : "pro_est",
        request_count: 1,
        estimated_cost_usd: cost,
        billing_month: month,
        last_requested_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    logServerError("discovery.usage.write", err);
  }
}

export async function getDiscoveryAvailability(): Promise<DiscoveryAvailability> {
  const f = fsqFlags();
  if (!f.discoveryEnabled) {
    return { nearby: false, reason: "Discovery disabled by configuration." };
  }
  if (!normalizeFoursquareApiKey(process.env.FOURSQUARE_API_KEY ?? "")) {
    return { nearby: false, reason: "FOURSQUARE_API_KEY is not configured." };
  }
  const usage = await readUsage();
  if (usage.discovery >= f.discoveryCallLimit) {
    return {
      nearby: false,
      reason: "Monthly discovery call ceiling reached.",
    };
  }
  return { nearby: true };
}

export async function getEnrichmentAvailability(): Promise<EnrichmentAvailability> {
  const f = fsqFlags();
  const usage = await readUsage();
  const budgetOk = usage.enrichmentUsd < f.enrichmentBudgetUsd;

  if (!f.enrichmentEnabled || !budgetOk) {
    return {
      details: false,
      premiumDetails: false,
      photos: false,
      tips: false,
    };
  }

  // Degradation order when approaching budget: tips → photos → premium details
  const remaining = f.enrichmentBudgetUsd - usage.enrichmentUsd;
  const tipsOk = f.tipsEnabled && remaining >= f.costTipsUsd;
  const photosOk = f.photosEnabled && remaining >= f.costPhotosUsd;
  const premiumOk = remaining >= f.costDetailsUsd;

  return {
    details: true,
    premiumDetails: premiumOk,
    photos: photosOk,
    tips: tipsOk,
  };
}
