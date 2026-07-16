import { clampScore, type RuleResult } from "../types";

export type R4Input = {
  isFirstTouchWithValue: boolean; // gating condition: wallet's first-ever interaction with this contract, with value or an approval attached
  valueRatioOfWallet: number; // tx value as a fraction of the wallet's total balance, e.g. 0.05 = 5%
  contractAgeDays: number | null;
  verifiedOnExplorer: boolean | null; // null = unknown, never treated as a penalty on its own
};

export type R4Config = {
  baseScore: number;
  highValueRatio: number;
  highValueBonus: number;
  youngContractDays: number;
  youngContractBonus: number;
  unverifiedBonus: number;
};

export const R4_DEFAULT_CONFIG: R4Config = {
  baseScore: 30,
  highValueRatio: 0.05,
  highValueBonus: 20,
  youngContractDays: 7,
  youngContractBonus: 25,
  unverifiedBonus: 15,
};

/**
 * R4 — First-touch contract with value. Gated on Horizon having already
 * flagged this as the wallet's first interaction with the contract and that
 * the interaction carried value or an approval (spec section 4, point 6).
 */
export function scoreR4FirstTouchContract(input: R4Input, config: Partial<R4Config> = {}): RuleResult {
  const cfg = { ...R4_DEFAULT_CONFIG, ...config };

  if (!input.isFirstTouchWithValue) {
    return { ruleId: "R4", score: 0, triggered: false, details: { ...input } };
  }

  const isHighValue = input.valueRatioOfWallet > cfg.highValueRatio;
  const isYoungContract = input.contractAgeDays !== null && input.contractAgeDays < cfg.youngContractDays;
  const isUnverified = input.verifiedOnExplorer === false;

  const score = clampScore(
    cfg.baseScore +
      (isHighValue ? cfg.highValueBonus : 0) +
      (isYoungContract ? cfg.youngContractBonus : 0) +
      (isUnverified ? cfg.unverifiedBonus : 0),
  );

  return {
    ruleId: "R4",
    score,
    triggered: true,
    details: { ...input, isHighValue, isYoungContract, isUnverified },
  };
}
