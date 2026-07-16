import { clampScore, type RuleResult } from "../types";

export type R5Input = {
  breached: boolean; // wallet balance is currently below the user-set floor
  projectedBreachWithin7d: boolean; // not yet breached, but will be at current velocity within 7 days
};

export type R5Config = {
  projectedScore: number;
  actualScore: number;
};

export const R5_DEFAULT_CONFIG: R5Config = {
  projectedScore: 60,
  actualScore: 90,
};

/**
 * R5 — Floor breach. An actual breach always outranks a projected one, per
 * spec section 5 ("90 on actual breach" vs "60 if projected... within 7d").
 */
export function scoreR5FloorBreach(input: R5Input, config: Partial<R5Config> = {}): RuleResult {
  const cfg = { ...R5_DEFAULT_CONFIG, ...config };

  if (input.breached) {
    return { ruleId: "R5", score: clampScore(cfg.actualScore), triggered: true, details: { ...input } };
  }

  if (input.projectedBreachWithin7d) {
    return { ruleId: "R5", score: clampScore(cfg.projectedScore), triggered: true, details: { ...input } };
  }

  return { ruleId: "R5", score: 0, triggered: false, details: { ...input } };
}
