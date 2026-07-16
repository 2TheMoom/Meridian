import type { Address, PublicClient } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWalletBalances } from "./balances";
import { type ApprovalLog, getApprovalLogsForWallets, getTransferLogsForWallets, type TransferLog } from "./logs";
import { setLastProcessedBlock } from "./syncState";

const UINT256_MAX = 2n ** 256n - 1n;
const UNLIMITED_APPROVAL_RATIO = 10n;

export type RegisteredWallet = { id: string; address: Address };

export async function processWindow(
  supabase: SupabaseClient,
  client: PublicClient,
  wallets: RegisteredWallet[],
  fromBlock: bigint,
  toBlock: bigint,
): Promise<void> {
  if (wallets.length === 0) return;

  const addresses = wallets.map((w) => w.address);
  const [transferLogs, approvalLogs, allowlistRows] = await Promise.all([
    getTransferLogsForWallets(client, addresses, fromBlock, toBlock),
    getApprovalLogsForWallets(client, addresses, fromBlock, toBlock),
    supabase.from("allowlist").select("address"),
  ]);

  const allowlist = new Set(
    ((allowlistRows.data ?? []) as { address: string }[]).map((r) => r.address.toLowerCase()),
  );

  await Promise.all(
    wallets.map((wallet) =>
      processWalletWindow(supabase, client, wallet, transferLogs, approvalLogs, allowlist, fromBlock, toBlock),
    ),
  );
}

async function processWalletWindow(
  supabase: SupabaseClient,
  client: PublicClient,
  wallet: RegisteredWallet,
  transferLogs: TransferLog[],
  approvalLogs: ApprovalLog[],
  allowlist: Set<string>,
  fromBlock: bigint,
  toBlock: bigint,
) {
  const addr = wallet.address.toLowerCase();

  const walletApprovalLogs = approvalLogs.filter((log) => log.args.owner.toLowerCase() === addr);
  const walletTransferLogs = transferLogs.filter(
    (log) => log.args.from.toLowerCase() === addr || log.args.to.toLowerCase() === addr,
  );

  const touchedTokens = [
    ...new Set([...walletApprovalLogs, ...walletTransferLogs].map((log) => log.address)),
  ] as Address[];
  const balances = await getWalletBalances(client, wallet.address, touchedTokens);

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

  const { error } = await supabase.from("snapshots").upsert(
    {
      wallet_id: wallet.id,
      from_block: fromBlock.toString(),
      to_block: toBlock.toString(),
      approvals,
      balances,
      outflow_usd: 0, // USD normalization is Week 3 scope (price cache), see spec section 10
    },
    { onConflict: "wallet_id,from_block,to_block" },
  );

  if (error) throw new Error(`snapshot upsert failed for wallet ${wallet.id}: ${error.message}`);

  await setLastProcessedBlock(supabase, wallet.id, toBlock);
}
