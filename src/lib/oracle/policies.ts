import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MOMENT_THRESHOLD, type RuleId } from "./types";

export type PolicyTier = "off" | "notify" | "confirm";

export type Policy = {
  tier: PolicyTier;
  threshold: Record<string, unknown>;
};

const DEFAULT_POLICY: Policy = { tier: "notify", threshold: {} };

/**
 * `policies` has no row until the user (or a seeding step) creates one —
 * the DB column default (tier='notify') only applies once a row exists, so
 * an absent row is the same as an explicit 'notify' with no overrides.
 */
export async function getPolicy(supabase: SupabaseClient, walletId: string, ruleId: RuleId): Promise<Policy> {
  const { data, error } = await supabase
    .from("policies")
    .select("tier, threshold")
    .eq("wallet_id", walletId)
    .eq("rule_id", ruleId)
    .maybeSingle();

  if (error) throw new Error(`policy lookup failed for wallet ${walletId} rule ${ruleId}: ${error.message}`);
  if (!data) return DEFAULT_POLICY;

  return { tier: data.tier as PolicyTier, threshold: (data.threshold as Record<string, unknown>) ?? {} };
}

export function momentThresholdFor(policy: Policy): number {
  const override = policy.threshold.momentThreshold;
  return typeof override === "number" ? override : DEFAULT_MOMENT_THRESHOLD;
}
