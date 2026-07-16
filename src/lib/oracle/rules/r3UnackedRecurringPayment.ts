import { clampScore, type RuleResult } from "../types";

export type R3Input = {
  acked: boolean; // patterns.user_ack — user already confirmed this is intentional
  amountTrendingUpward: boolean; // amount increasing across occurrences
};

export type R3Config = {
  baseScore: number;
  trendingUpwardBonus: number;
};

export const R3_DEFAULT_CONFIG: R3Config = {
  baseScore: 40,
  trendingUpwardBonus: 20,
};

/**
 * R3 — Unacked recurring payment. Never fires once the user has acked the
 * pattern (patterns.user_ack = true suppresses this rule going forward).
 */
export function scoreR3UnackedRecurringPayment(
  input: R3Input,
  config: Partial<R3Config> = {},
): RuleResult {
  const cfg = { ...R3_DEFAULT_CONFIG, ...config };

  if (input.acked) {
    return { ruleId: "R3", score: 0, triggered: false, details: { ...input } };
  }

  const score = clampScore(cfg.baseScore + (input.amountTrendingUpward ? cfg.trendingUpwardBonus : 0));

  return { ruleId: "R3", score, triggered: true, details: { ...input } };
}
