import { R1_DEFAULT_CONFIG, scoreR1RiskyApproval } from "./rules/r1RiskyApproval";
import type { RuleId } from "./types";

export type GuardVerdict = "safe" | "caution" | "danger" | "not-a-contract";

export type GuardInput = {
  contractAgeDays: number | null;
  allowlisted: boolean;
  verifiedOnExplorer: boolean | null;
};

export type GuardCheck = {
  verdict: GuardVerdict;
  score: number;
  isYoungContract: boolean;
  ruleId: RuleId;
  details: Record<string, unknown>;
};

/**
 * Guard answers "should I approve this address" — before a signature, not
 * after. R1/R6 score an approval that already happened; this reuses the
 * exact same signals (age, allowlist status) but the question is different,
 * so the verdict bands are too. R1's raw formula always adds the
 * not-allowlisted bonus once you're off the allowlist (base 70 + 15 = 85
 * minimum), which would make every unvetted contract "danger" regardless of
 * age — collapsing the caution/danger distinction entirely. The age
 * boundary is the actually meaningful signal for "should I be worried right
 * now": a young, unvetted contract is the classic drainer pattern; an old,
 * unvetted one merely hasn't been reviewed by us yet.
 */
export function evaluateGuard(input: GuardInput): GuardCheck {
  const isYoungContract = input.contractAgeDays !== null && input.contractAgeDays < R1_DEFAULT_CONFIG.youngContractDays;

  // Reuse R1's real formula for the numeric score shown alongside the
  // verdict, so Guard's number means the same thing a Moment's does
  // elsewhere in the app — assume the worst case (an unlimited-style grant),
  // since that's the scenario Guard exists to warn about before it happens.
  const scored = scoreR1RiskyApproval({
    unlimited: true,
    contractAgeDays: input.contractAgeDays,
    allowlisted: input.allowlisted,
  });

  if (input.allowlisted) {
    return { verdict: "safe", score: 0, isYoungContract, ruleId: "R1", details: { ...input, isYoungContract } };
  }

  const verdict: GuardVerdict = isYoungContract || input.verifiedOnExplorer === false ? "danger" : "caution";

  return {
    verdict,
    score: scored.score,
    isYoungContract,
    ruleId: "R1",
    details: { ...input, isYoungContract },
  };
}
