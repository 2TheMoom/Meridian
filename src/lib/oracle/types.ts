export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

export type RuleResult = {
  ruleId: RuleId;
  score: number; // 0-100, always; a rule that didn't fire returns 0
  triggered: boolean; // score > 0 — kept explicit so callers don't have to remember that convention
  details: Record<string, unknown>; // raw inputs/intermediate values, stored verbatim in moments.context for Oracle's explanation layer and for audit
};

export const DEFAULT_MOMENT_THRESHOLD = 50;

export type MomentStatus = "open" | "acked" | "acted" | "dismissed" | "snoozed";

// Mirrors the `moments` table row (spec section 8), as read by the client.
export type Moment = {
  id: string;
  wallet_id: string;
  rule_id: RuleId;
  score: number;
  context: Record<string, unknown>;
  oracle_text: string | null;
  status: MomentStatus;
  tx_ref: string | null;
  created_at: string;
};

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
