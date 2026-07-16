import { clampScore, type RuleResult } from "../types";

export type R2Input = {
  outflow7dUsd: number;
  trailing30dOutflowUsd: number; // used to derive a comparable 7-day baseline
};

export type R2Tier = { ratio: number; score: number };

export type R2Config = {
  tiers: R2Tier[]; // ascending by ratio; the highest tier whose ratio is exceeded wins
};

export const R2_DEFAULT_CONFIG: R2Config = {
  tiers: [
    { ratio: 2, score: 50 },
    { ratio: 4, score: 75 },
    { ratio: 8, score: 95 },
  ],
};

/**
 * R2 — Velocity spike. Compares actual 7-day outflow to what the trailing
 * 30-day baseline would predict for a 7-day slice, per spec section 5.
 */
export function scoreR2VelocitySpike(input: R2Input, config: Partial<R2Config> = {}): RuleResult {
  const cfg = { ...R2_DEFAULT_CONFIG, ...config };
  const baseline7dEquivalent = (input.trailing30dOutflowUsd / 30) * 7;

  const ratio =
    baseline7dEquivalent > 0
      ? input.outflow7dUsd / baseline7dEquivalent
      : input.outflow7dUsd > 0
        ? Infinity
        : 0;

  const tiers = [...cfg.tiers].sort((a, b) => a.ratio - b.ratio);
  const matchedTier = [...tiers].reverse().find((tier) => ratio > tier.ratio);

  if (!matchedTier) {
    return { ruleId: "R2", score: 0, triggered: false, details: { ...input, ratio, baseline7dEquivalent } };
  }

  return {
    ruleId: "R2",
    score: clampScore(matchedTier.score),
    triggered: true,
    details: { ...input, ratio, baseline7dEquivalent, matchedTier },
  };
}
