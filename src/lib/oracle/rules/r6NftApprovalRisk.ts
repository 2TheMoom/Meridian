import { clampScore, type RuleResult } from "../types";

export type R6Input = {
  approved: boolean; // ApprovalForAll's own flag — true grants the operator blanket, collection-wide control; false is a revoke and never risky
  contractAgeDays: number | null; // null = unknown age, treated as "not young" (no bonus, no penalty)
  allowlisted: boolean;
};

export type R6Config = {
  baseScore: number;
  youngContractDays: number;
  youngContractBonus: number;
  notAllowlistedBonus: number;
};

export const R6_DEFAULT_CONFIG: R6Config = {
  baseScore: 70,
  youngContractDays: 14,
  youngContractBonus: 15,
  notAllowlistedBonus: 15,
};

/**
 * R6 — NFT approval risk. Mirrors R1's shape, but the entry condition
 * differs: ERC-721/1155's `setApprovalForAll` has no partial form — a grant
 * is always all-or-nothing collection-wide control, so unlike R1 there's no
 * "bounded approval" case to exclude. Any `approved: true` is the entry
 * condition; `approved: false` (a revoke) never triggers.
 */
export function scoreR6NftApprovalRisk(input: R6Input, config: Partial<R6Config> = {}): RuleResult {
  const cfg = { ...R6_DEFAULT_CONFIG, ...config };

  if (!input.approved) {
    return { ruleId: "R6", score: 0, triggered: false, details: { ...input } };
  }

  const isYoungContract = input.contractAgeDays !== null && input.contractAgeDays < cfg.youngContractDays;
  const score = clampScore(
    cfg.baseScore +
      (isYoungContract ? cfg.youngContractBonus : 0) +
      (!input.allowlisted ? cfg.notAllowlistedBonus : 0),
  );

  return {
    ruleId: "R6",
    score,
    triggered: true,
    details: { ...input, isYoungContract },
  };
}
