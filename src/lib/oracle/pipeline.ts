import type { Address, PublicClient } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExplainFn } from "./explain";
import { RULE_LABELS } from "./labels";
import { getPolicy, momentThresholdFor, type Policy } from "./policies";
import {
  scoreR1RiskyApproval,
  scoreR2VelocitySpike,
  scoreR3UnackedRecurringPayment,
  scoreR4FirstTouchContract,
  scoreR5FloorBreach,
} from "./rules";
import type { RuleResult } from "./types";
import { getContractAgeDays } from "../horizon/contractAge";
import { getVerificationStatus } from "../horizon/explorerVerification";
import { sendMomentNotification } from "../notifications/resend";

export type WalletInfo = {
  id: string;
  address: string;
  chainId: number;
  label: string | null;
  notificationEmail: string | null;
};

export type ApprovalRecord = {
  token: string;
  spender: string;
  amount: string;
  tx_hash: string;
  block_number: string;
  unlimited: boolean;
  allowlisted: boolean;
};

export type SnapshotRow = {
  wallet_id: string;
  from_block: string;
  to_block: string;
  approvals: ApprovalRecord[];
  balances: { native: string; tokens: Record<string, string> };
  outflow_usd: number;
};

export function shouldCreateMoment(policy: Policy, result: RuleResult): boolean {
  return result.triggered && policy.tier !== "off" && result.score >= momentThresholdFor(policy);
}

// Alarm-fatigue control (spec section 7: "cap Moments surfaced per day").
// Deduplication is handled per-rule in momentAlreadyExists below (one moment
// per approval tx for R1/R4, one open moment per rule for R2/R3/R5); this is
// the separate total-volume cap across all rules for one wallet.
const DAILY_MOMENT_CAP = Number(process.env.ORACLE_DAILY_MOMENT_CAP ?? 10);

async function dailyCapReached(supabase: SupabaseClient, walletId: string): Promise<boolean> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("moments")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", walletId)
    .gte("created_at", startOfToday.toISOString());

  if (error) throw new Error(`daily cap check failed: ${error.message}`);
  return (count ?? 0) >= DAILY_MOMENT_CAP;
}

async function momentAlreadyExists(
  supabase: SupabaseClient,
  filters: { walletId: string; ruleId: string; txRef?: string; openOnly?: boolean },
): Promise<boolean> {
  let query = supabase
    .from("moments")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", filters.walletId)
    .eq("rule_id", filters.ruleId);

  if (filters.txRef) query = query.eq("tx_ref", filters.txRef);
  if (filters.openOnly) query = query.eq("status", "open");

  const { count, error } = await query;
  if (error) throw new Error(`moment dedup check failed: ${error.message}`);
  return (count ?? 0) > 0;
}

async function insertMoment(
  supabase: SupabaseClient,
  walletId: string,
  result: RuleResult,
  oracleText: string,
  txRef: string | null,
): Promise<void> {
  const { error } = await supabase.from("moments").insert({
    wallet_id: walletId,
    rule_id: result.ruleId,
    score: result.score,
    context: result.details,
    oracle_text: oracleText,
    status: "open",
    tx_ref: txRef,
  });

  if (error) throw new Error(`moment insert failed for wallet ${walletId} rule ${result.ruleId}: ${error.message}`);
}

async function explainAndInsert(
  supabase: SupabaseClient,
  wallet: WalletInfo,
  result: RuleResult,
  txRef: string | null,
  explain: ExplainFn,
): Promise<void> {
  // Checked fresh per candidate moment rather than once per pipeline run:
  // simpler than threading a shared budget through five concurrently-run
  // rule evaluators, at the cost of a small, bounded overshoot risk (at most
  // a few moments over cap in one window, if multiple rules fire in the same
  // run) rather than a hard guarantee. Fine for an alarm-fatigue cap, not
  // something that needs DB-level locking.
  if (await dailyCapReached(supabase, wallet.id)) {
    console.warn(`[oracle] daily moment cap reached for wallet ${wallet.id}, suppressing ${result.ruleId}`);
    return;
  }

  const { oracleText } = await explain({
    ruleId: result.ruleId,
    details: result.details,
    walletContext: { label: wallet.label, chainId: wallet.chainId },
  });
  await insertMoment(supabase, wallet.id, result, oracleText, txRef);

  // Notify tier (and Confirm, which spec section 6 defines as Notify plus a
  // prepared action) both mean "email immediately." shouldCreateMoment
  // already excludes tier 'off' before we get here. Best-effort: a failed
  // send must not undo or retry-loop the moment that's already durable.
  if (wallet.notificationEmail) {
    const sent = await sendMomentNotification({
      to: wallet.notificationEmail,
      ruleLabel: RULE_LABELS[result.ruleId],
      score: result.score,
      oracleText,
      walletLabel: wallet.label,
      walletAddress: wallet.address,
    }).catch((err) => {
      console.error(`[oracle] notification send threw for wallet ${wallet.id}`, err);
      return false;
    });
    if (!sent) console.warn(`[oracle] notification not sent for wallet ${wallet.id} rule ${result.ruleId}`);
  }
}

/**
 * R1 — risky approval. Fully live, including the young-contract bonus:
 * contract age comes from an RPC binary search on `eth_getCode` (see
 * horizon/contractAge.ts), cached indefinitely per address, no third-party
 * API required.
 */
async function evaluateR1(
  supabase: SupabaseClient,
  client: PublicClient,
  wallet: WalletInfo,
  snapshot: SnapshotRow,
  explain: ExplainFn,
) {
  const policy = await getPolicy(supabase, wallet.id, "R1");

  for (const approval of snapshot.approvals) {
    const contractAgeDays = await getContractAgeDays(client, approval.spender as Address);
    const result = scoreR1RiskyApproval({
      unlimited: approval.unlimited,
      contractAgeDays,
      allowlisted: approval.allowlisted,
    });
    if (!shouldCreateMoment(policy, result)) continue;
    if (await momentAlreadyExists(supabase, { walletId: wallet.id, ruleId: "R1", txRef: approval.tx_hash })) continue;

    await explainAndInsert(
      supabase,
      wallet,
      { ...result, details: { ...result.details, token: approval.token, spender: approval.spender, amount: approval.amount } },
      approval.tx_hash,
      explain,
    );
  }
}

/**
 * R4 — first-touch contract. Approval-gated only: a native-value-bearing
 * call to a new contract isn't detectable yet (Horizon only watches ERC-20
 * Transfer/Approval logs, not native-value call data — see worker README).
 * "First touch" means first seen since Meridian started watching this
 * wallet, not full on-chain history — v1 doesn't backfill (see spec).
 * Contract age and explorer-verification are both live now (see
 * evaluateR1's comment on age; verification needs ETHERSCAN_API_KEY set,
 * degrading to "unknown" rather than "unverified" without one). Value-ratio
 * stays 0 until native-value tracking exists, so R4 still can't reach its
 * highest scores, but it now clears the default 50-point threshold on a
 * genuinely new, unverified contract.
 */
async function evaluateR4(
  supabase: SupabaseClient,
  client: PublicClient,
  wallet: WalletInfo,
  snapshot: SnapshotRow,
  explain: ExplainFn,
) {
  if (snapshot.approvals.length === 0) return;

  const { data: priorRows, error } = await supabase
    .from("snapshots")
    .select("approvals")
    .eq("wallet_id", wallet.id)
    .lt("from_block", snapshot.from_block);

  if (error) throw new Error(`prior-snapshot lookup failed for R4: ${error.message}`);

  const previouslySeen = new Set<string>();
  for (const row of (priorRows ?? []) as { approvals: ApprovalRecord[] }[]) {
    for (const approval of row.approvals) previouslySeen.add(approval.spender.toLowerCase());
  }

  const policy = await getPolicy(supabase, wallet.id, "R4");
  const seenThisSnapshot = new Set<string>();

  for (const approval of snapshot.approvals) {
    const spender = approval.spender.toLowerCase();
    const isFirstTouch = !previouslySeen.has(spender) && !seenThisSnapshot.has(spender);
    seenThisSnapshot.add(spender);

    const [contractAgeDays, verifiedOnExplorer] = await Promise.all([
      getContractAgeDays(client, approval.spender as Address),
      getVerificationStatus(wallet.chainId, approval.spender as Address),
    ]);

    const result = scoreR4FirstTouchContract({
      isFirstTouchWithValue: isFirstTouch,
      valueRatioOfWallet: 0, // native-value tracking not yet implemented, see comment above
      contractAgeDays,
      verifiedOnExplorer,
    });
    if (!shouldCreateMoment(policy, result)) continue;
    if (await momentAlreadyExists(supabase, { walletId: wallet.id, ruleId: "R4", txRef: approval.tx_hash })) continue;

    await explainAndInsert(
      supabase,
      wallet,
      { ...result, details: { ...result.details, token: approval.token, spender: approval.spender } },
      approval.tx_hash,
      explain,
    );
  }
}

/**
 * R5 — floor breach. Live for actual breaches (compares the snapshot's
 * native balance to policies.threshold.floorNative). Projected breach
 * ("will breach within 7d at current velocity") needs the same outflow
 * data R2 does, so it's always false for now — see evaluateR2.
 */
async function evaluateR5(supabase: SupabaseClient, wallet: WalletInfo, snapshot: SnapshotRow, explain: ExplainFn) {
  const policy = await getPolicy(supabase, wallet.id, "R5");
  const floorNative = policy.threshold.floorNative;
  if (typeof floorNative !== "string") return; // no floor configured for this wallet

  const breached = BigInt(snapshot.balances.native) < BigInt(floorNative);
  const result = scoreR5FloorBreach({ breached, projectedBreachWithin7d: false });
  if (!shouldCreateMoment(policy, result)) return;
  if (await momentAlreadyExists(supabase, { walletId: wallet.id, ruleId: "R5", openOnly: true })) return;

  await explainAndInsert(supabase, wallet, result, null, explain);
}

/**
 * R2 — velocity spike. Structurally wired but inert: outflow_usd is always
 * 0 until the Week 3 price cache lands (see window.ts), so the ratio this
 * computes is always 0/0 and never triggers. Left in place so R2 activates
 * automatically once USD normalization exists, without another pipeline
 * change.
 */
async function evaluateR2(supabase: SupabaseClient, wallet: WalletInfo, explain: ExplainFn) {
  const policy = await getPolicy(supabase, wallet.id, "R2");
  if (policy.tier === "off") return;
  if (await momentAlreadyExists(supabase, { walletId: wallet.id, ruleId: "R2", openOnly: true })) return;

  const now = Date.now();
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("snapshots")
    .select("outflow_usd, created_at")
    .eq("wallet_id", wallet.id)
    .gte("created_at", since30d);
  if (error) throw new Error(`outflow lookup failed for R2: ${error.message}`);

  let outflow7dUsd = 0;
  let trailing30dOutflowUsd = 0;
  for (const row of (data ?? []) as { outflow_usd: number; created_at: string }[]) {
    trailing30dOutflowUsd += row.outflow_usd;
    if (row.created_at >= since7d) outflow7dUsd += row.outflow_usd;
  }

  const result = scoreR2VelocitySpike({ outflow7dUsd, trailing30dOutflowUsd });
  if (!shouldCreateMoment(policy, result)) return;

  await explainAndInsert(supabase, wallet, result, null, explain);
}

/**
 * R3 — unacked recurring payment. Structurally wired but inert: Horizon
 * does not yet detect recurring payments and write `patterns` rows for them
 * (spec section 4, point 3) — this evaluates whatever pattern rows exist,
 * which today is none. Activates once that detection is built.
 */
async function evaluateR3(supabase: SupabaseClient, wallet: WalletInfo, explain: ExplainFn) {
  const policy = await getPolicy(supabase, wallet.id, "R3");
  if (policy.tier === "off") return;

  const { data, error } = await supabase
    .from("patterns")
    .select("id, params")
    .eq("wallet_id", wallet.id)
    .eq("type", "recurring")
    .eq("user_ack", false);
  if (error) throw new Error(`pattern lookup failed for R3: ${error.message}`);

  for (const pattern of (data ?? []) as { id: string; params: { amountTrendingUpward?: boolean } }[]) {
    const result = scoreR3UnackedRecurringPayment({
      acked: false,
      amountTrendingUpward: Boolean(pattern.params?.amountTrendingUpward),
    });
    if (!shouldCreateMoment(policy, result)) continue;

    const { count, error: dedupError } = await supabase
      .from("moments")
      .select("id", { count: "exact", head: true })
      .eq("wallet_id", wallet.id)
      .eq("rule_id", "R3")
      .eq("status", "open")
      .contains("context", { patternId: pattern.id });
    if (dedupError) throw new Error(`R3 dedup check failed: ${dedupError.message}`);
    if ((count ?? 0) > 0) continue;

    await explainAndInsert(
      supabase,
      wallet,
      { ...result, details: { ...result.details, patternId: pattern.id } },
      null,
      explain,
    );
  }
}

/**
 * Evaluates all five rules against one freshly-written snapshot and creates
 * `moments` rows for anything that clears its policy's threshold. Called
 * right after Horizon upserts a snapshot (see horizon/window.ts). Rules are
 * evaluated independently and a failure in one does not block the others.
 */
export async function createMomentsFromSnapshot(
  supabase: SupabaseClient,
  client: PublicClient,
  wallet: WalletInfo,
  snapshot: SnapshotRow,
  explain: ExplainFn,
): Promise<void> {
  const evaluations = [
    evaluateR1(supabase, client, wallet, snapshot, explain),
    evaluateR4(supabase, client, wallet, snapshot, explain),
    evaluateR5(supabase, wallet, snapshot, explain),
    evaluateR2(supabase, wallet, explain),
    evaluateR3(supabase, wallet, explain),
  ];

  const results = await Promise.allSettled(evaluations);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(`[oracle] moment evaluation failed for wallet ${wallet.id}`, result.reason);
    }
  }
}
