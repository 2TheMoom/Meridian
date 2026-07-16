import { clampScore, type RuleResult } from "../types";

export type R1Input = {
  unlimited: boolean; // amount is type(uint256).max-style, or > 10x wallet's token balance — computed upstream by Horizon
  contractAgeDays: number | null; // null = unknown age, treated as "not young" (no bonus, no penalty)
  allowlisted: boolean;
};

export type R1Config = {
  baseScore: number;
  youngContractDays: number;
  youngContractBonus: number;
  notAllowlistedBonus: number;
};

export const R1_DEFAULT_CONFIG: R1Config = {
  baseScore: 70,
  youngContractDays: 14,
  youngContractBonus: 15,
  notAllowlistedBonus: 15,
};

/**
 * R1 — Risky approval. Only fires on an unlimited-style approval; a bounded
 * approval never triggers R1 regardless of contract age/allowlist status,
 * per spec section 5 ("Unlimited approval = 70" is the entry condition, the
 * two +15s are modifiers on top of that base).
 */
export function scoreR1RiskyApproval(input: R1Input, config: Partial<R1Config> = {}): RuleResult {
  const cfg = { ...R1_DEFAULT_CONFIG, ...config };

  if (!input.unlimited) {
    return { ruleId: "R1", score: 0, triggered: false, details: { ...input } };
  }

  const isYoungContract = input.contractAgeDays !== null && input.contractAgeDays < cfg.youngContractDays;
  const score = clampScore(
    cfg.baseScore +
      (isYoungContract ? cfg.youngContractBonus : 0) +
      (!input.allowlisted ? cfg.notAllowlistedBonus : 0),
  );

  return {
    ruleId: "R1",
    score,
    triggered: true,
    details: { ...input, isYoungContract },
  };
}
