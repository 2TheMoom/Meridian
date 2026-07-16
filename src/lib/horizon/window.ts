import type { Address, PublicClient } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWalletBalances } from "./balances";
import { getTokenDecimals } from "./decimals";
import {
  type ApprovalForAllLog,
  type ApprovalLog,
  getApprovalForAllLogsForWallets,
  getApprovalLogsForWallets,
  getTransferLogsForWallets,
  type TransferLog,
} from "./logs";
import { computeOutflowUsd } from "./outflow";
import { recordOutgoingTransfer } from "./patterns";
import { setLastProcessedBlock } from "./syncState";
import type { ExplainFn } from "../oracle/explain";
import { createMomentsFromSnapshot } from "../oracle/pipeline";
import { getPricesUsd } from "../pricing/priceCache";

const UINT256_MAX = 2n ** 256n - 1n;
const UNLIMITED_APPROVAL_RATIO = 10n;

export type RegisteredWallet = {
  id: string;
  address: Address;
  label: string | null;
  notificationEmail: string | null;
};

export async function processWindow(
  supabase: SupabaseClient,
  client: PublicClient,
  chainId: number,
  wallets: RegisteredWallet[],
  fromBlock: bigint,
  toBlock: bigint,
  explain: ExplainFn,
): Promise<void> {
  if (wallets.length === 0) return;

  const addresses = wallets.map((w) => w.address);
  const [transferLogs, approvalLogs, approvalForAllLogs, allowlistRows] = await Promise.all([
    getTransferLogsForWallets(client, addresses, fromBlock, toBlock),
    getApprovalLogsForWallets(client, addresses, fromBlock, toBlock),
    getApprovalForAllLogsForWallets(client, addresses, fromBlock, toBlock),
    // Allowlist entries are chain-scoped: the same address can be an
    // unrelated contract on a different network, so never mix networks here.
    supabase.from("allowlist").select("address").eq("chain_id", chainId),
  ]);

  const allowlist = new Set(
    ((allowlistRows.data ?? []) as { address: string }[]).map((r) => r.address.toLowerCase()),
  );

  await Promise.all(
    wallets.map((wallet) =>
      processWalletWindow(
        supabase,
        client,
        chainId,
        wallet,
        transferLogs,
        approvalLogs,
        approvalForAllLogs,
        allowlist,
        fromBlock,
        toBlock,
        explain,
      ),
    ),
  );
}

async function processWalletWindow(
  supabase: SupabaseClient,
  client: PublicClient,
  chainId: number,
  wallet: RegisteredWallet,
  transferLogs: TransferLog[],
  approvalLogs: ApprovalLog[],
  approvalForAllLogs: ApprovalForAllLog[],
  allowlist: Set<string>,
  fromBlock: bigint,
  toBlock: bigint,
  explain: ExplainFn,
) {
  const addr = wallet.address.toLowerCase();

  const walletApprovalLogs = approvalLogs.filter((log) => log.args.owner.toLowerCase() === addr);
  const walletApprovalForAllLogs = approvalForAllLogs.filter((log) => log.args.owner.toLowerCase() === addr);
  const walletTransferLogs = transferLogs.filter(
    (log) => log.args.from.toLowerCase() === addr || log.args.to.toLowerCase() === addr,
  );

  const touchedTokens = [
    ...new Set([...walletApprovalLogs, ...walletTransferLogs].map((log) => log.address)),
  ] as Address[];

  const [balances, priorNativeBalance, prices, tokenDecimals] = await Promise.all([
    getWalletBalances(client, wallet.address, touchedTokens),
    getPriorNativeBalance(supabase, wallet.id),
    getPricesUsd(supabase, chainId, touchedTokens),
    getTokenDecimals(client, touchedTokens),
  ]);

  const outflowUsd = computeOutflowUsd({
    walletAddress: wallet.address,
    walletTransferLogs,
    priorNativeBalance,
    currentNativeBalance: BigInt(balances.native),
    nativePriceUsd: prices.native,
    tokenPricesUsd: prices.tokens,
    tokenDecimals,
  });

  const approvals = walletApprovalLogs.map((log) => {
    const token = log.address.toLowerCase();
    const amount = log.args.value;
    const tokenBalance = BigInt(balances.tokens[token] ?? "0");
    const nearMax = amount >= UINT256_MAX / 2n;
    const exceedsBalanceMultiple = tokenBalance > 0n && amount > tokenBalance * UNLIMITED_APPROVAL_RATIO;
    const spender = log.args.spender.toLowerCase();

    return {
      token,
      spender,
      amount: amount.toString(),
      tx_hash: log.transactionHash,
      block_number: log.blockNumber.toString(),
      unlimited: nearMax || exceedsBalanceMultiple,
      allowlisted: allowlist.has(spender),
    };
  });

  // ERC-721/1155 ApprovalForAll — never merged into touchedTokens/balances
  // above: NFT collections aren't ERC-20 tokens, and calling decimals()/
  // balanceOf(address)/a price lookup against one would misbehave or revert.
  const nftApprovals = walletApprovalForAllLogs.map((log) => {
    const operator = log.args.operator.toLowerCase();
    return {
      collection: log.address.toLowerCase(),
      operator,
      tx_hash: log.transactionHash,
      block_number: log.blockNumber.toString(),
      approved: log.args.approved,
      allowlisted: allowlist.has(operator),
    };
  });

  const snapshot = {
    wallet_id: wallet.id,
    from_block: fromBlock.toString(),
    to_block: toBlock.toString(),
    approvals,
    nft_approvals: nftApprovals,
    balances,
    outflow_usd: outflowUsd,
  };

  const { error } = await supabase
    .from("snapshots")
    .upsert(snapshot, { onConflict: "wallet_id,from_block,to_block" });

  if (error) throw new Error(`snapshot upsert failed for wallet ${wallet.id}: ${error.message}`);

  await setLastProcessedBlock(supabase, wallet.id, toBlock);

  // Recurring-payment detection (R3) needs discrete transfer history, not
  // just this window's aggregate — record each outgoing ERC-20 transfer and
  // let it update/create a `patterns` row before Oracle scores the window,
  // so a pattern that just formed is visible to R3 immediately. Sequential,
  // not parallel: the detection logic is read-then-write per (token,
  // recipient), and two transfers to the same recipient in one window would
  // race if processed concurrently.
  try {
    for (const log of walletTransferLogs) {
      if (log.args.from.toLowerCase() !== addr) continue;
      await recordOutgoingTransfer(supabase, wallet.id, {
        token: log.address.toLowerCase(),
        to: log.args.to.toLowerCase(),
        amount: log.args.value,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }
  } catch (err) {
    console.error(`[horizon] pattern detection failed for wallet ${wallet.id}`, err);
  }

  // Score the snapshot and create any moments it warrants. A failure here
  // must not roll back or block the snapshot/cursor writes above — those are
  // Horizon's job and are already durable; Oracle scoring can safely retry
  // by re-running against the same (idempotent) snapshot data later.
  try {
    await createMomentsFromSnapshot(
      supabase,
      client,
      { id: wallet.id, address: wallet.address, chainId, label: wallet.label, notificationEmail: wallet.notificationEmail },
      snapshot,
      explain,
    );
  } catch (err) {
    console.error(`[horizon] moment pipeline failed for wallet ${wallet.id}`, err);
  }
}

/**
 * Most recent snapshot's native balance for this wallet, queried before the
 * current window's snapshot is written — the baseline computeOutflowUsd
 * diffs against. Returns null for a wallet's first-ever snapshot (no
 * baseline yet, so native outflow for that window is skipped rather than
 * guessed).
 */
async function getPriorNativeBalance(supabase: SupabaseClient, walletId: string): Promise<bigint | null> {
  const { data, error } = await supabase
    .from("snapshots")
    .select("balances")
    .eq("wallet_id", walletId)
    .order("to_block", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`prior-balance lookup failed for wallet ${walletId}: ${error.message}`);
  if (!data) return null;

  const balances = data.balances as { native: string };
  return BigInt(balances.native);
}
