import type { SupabaseClient } from "@supabase/supabase-js";

// Spec section 4, point 3: "same recipient, amount within ±10%, interval
// regularity ±20%, >= 2 occurrences."
export const AMOUNT_TOLERANCE = 0.1;
export const INTERVAL_TOLERANCE = 0.2;

export type OutgoingTransfer = {
  token: string; // lowercase ERC-20 contract address — native transfers are never recorded here, see migration 0005
  to: string;
  amount: bigint;
  txHash: string;
  blockNumber: bigint;
};

export type PatternParams = {
  token: string;
  recipient: string;
  occurrences: number;
  avgAmount: string; // decimal string — a running average isn't necessarily an integer
  avgIntervalBlocks: string;
  lastAmount: string;
  lastBlockNumber: string;
  amountTrendingUpward: boolean;
};

/** True if `value` is within `tolerance` (a fraction, e.g. 0.1 = 10%) of `reference`. */
export function withinTolerance(value: number, reference: number, tolerance: number): boolean {
  if (reference === 0) return value === 0;
  return Math.abs(value - reference) / reference <= tolerance;
}

/** Running average after adding one more sample, given the prior average over `priorCount` samples. */
export function nextRunningAverage(priorAverage: number, priorCount: number, newValue: number): number {
  return (priorAverage * priorCount + newValue) / (priorCount + 1);
}

export async function recordOutgoingTransfer(
  supabase: SupabaseClient,
  walletId: string,
  transfer: OutgoingTransfer,
): Promise<void> {
  const { error: insertError } = await supabase.from("transfers").upsert(
    {
      wallet_id: walletId,
      token: transfer.token,
      to_address: transfer.to,
      amount: transfer.amount.toString(),
      tx_hash: transfer.txHash,
      block_number: transfer.blockNumber.toString(),
    },
    { onConflict: "wallet_id,tx_hash,token,to_address" },
  );
  if (insertError) throw new Error(`transfer record failed: ${insertError.message}`);

  await detectRecurringPattern(supabase, walletId, transfer);
}

async function detectRecurringPattern(
  supabase: SupabaseClient,
  walletId: string,
  transfer: OutgoingTransfer,
): Promise<void> {
  const { data: existing, error: patternError } = await supabase
    .from("patterns")
    .select("id, params")
    .eq("wallet_id", walletId)
    .eq("type", "recurring")
    .contains("params", { token: transfer.token, recipient: transfer.to })
    .maybeSingle();
  if (patternError) throw new Error(`pattern lookup failed: ${patternError.message}`);

  const amount = Number(transfer.amount);

  if (existing) {
    const params = existing.params as PatternParams;
    const avgAmount = Number(params.avgAmount);
    const avgIntervalBlocks = Number(params.avgIntervalBlocks);
    const intervalBlocks = Number(transfer.blockNumber - BigInt(params.lastBlockNumber));

    // Doesn't fit the established pattern — leave it as-is rather than
    // either rejecting the transfer or forking a competing pattern. v1
    // simplification: one recurring pattern per (wallet, token, recipient).
    if (!withinTolerance(amount, avgAmount, AMOUNT_TOLERANCE)) return;
    if (!withinTolerance(intervalBlocks, avgIntervalBlocks, INTERVAL_TOLERANCE)) return;

    const occurrences = params.occurrences + 1;
    const { error: updateError } = await supabase
      .from("patterns")
      .update({
        params: {
          ...params,
          occurrences,
          avgAmount: nextRunningAverage(avgAmount, params.occurrences, amount).toString(),
          avgIntervalBlocks: nextRunningAverage(avgIntervalBlocks, params.occurrences - 1, intervalBlocks).toString(),
          lastAmount: transfer.amount.toString(),
          lastBlockNumber: transfer.blockNumber.toString(),
          amountTrendingUpward: amount > avgAmount,
        } satisfies PatternParams,
      })
      .eq("id", existing.id);
    if (updateError) throw new Error(`pattern update failed: ${updateError.message}`);
    return;
  }

  // No pattern yet — look for exactly one prior transfer to the same
  // (token, recipient) to pair with this one as the pattern's first two
  // occurrences. A single unmatched transfer is not a pattern.
  const { data: priorRows, error: priorError } = await supabase
    .from("transfers")
    .select("amount, block_number")
    .eq("wallet_id", walletId)
    .eq("token", transfer.token)
    .eq("to_address", transfer.to)
    .lt("block_number", transfer.blockNumber.toString())
    .order("block_number", { ascending: false })
    .limit(1);
  if (priorError) throw new Error(`prior-transfer lookup failed: ${priorError.message}`);

  const prior = priorRows?.[0] as { amount: string; block_number: string } | undefined;
  if (!prior) return;

  const priorAmount = Number(prior.amount);
  if (!withinTolerance(amount, priorAmount, AMOUNT_TOLERANCE)) return;

  const intervalBlocks = Number(transfer.blockNumber - BigInt(prior.block_number));

  const { error: insertPatternError } = await supabase.from("patterns").insert({
    wallet_id: walletId,
    type: "recurring",
    user_ack: false,
    params: {
      token: transfer.token,
      recipient: transfer.to,
      occurrences: 2,
      avgAmount: ((priorAmount + amount) / 2).toString(),
      avgIntervalBlocks: intervalBlocks.toString(),
      lastAmount: transfer.amount.toString(),
      lastBlockNumber: transfer.blockNumber.toString(),
      amountTrendingUpward: amount > priorAmount,
    } satisfies PatternParams,
  });
  if (insertPatternError) throw new Error(`pattern insert failed: ${insertPatternError.message}`);
}
