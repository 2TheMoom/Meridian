import type { Address, Log, PublicClient } from "viem";
import { approvalEvent, approvalForAllEvent, transferEvent } from "./abi";

const DEFAULT_CHUNK_BLOCKS = 500;

function chunkBlocks() {
  const raw = Number(process.env.LOGS_CHUNK_BLOCKS ?? DEFAULT_CHUNK_BLOCKS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CHUNK_BLOCKS;
}

export type TransferLog = Log<bigint, number, false, typeof transferEvent, true>;
export type ApprovalLog = Log<bigint, number, false, typeof approvalEvent, true>;
export type ApprovalForAllLog = Log<bigint, number, false, typeof approvalForAllEvent, true>;

/**
 * Runs `fn` once per [fromBlock, toBlock] sub-range no wider than LOGS_CHUNK_BLOCKS,
 * concatenating results. Providers cap eth_getLogs block ranges, so any span that
 * might exceed a few hundred/thousand blocks (cron backfill after downtime) must
 * be chunked — live windowed processing stays well under the chunk size already.
 */
async function inChunks<T>(
  fromBlock: bigint,
  toBlock: bigint,
  fn: (from: bigint, to: bigint) => Promise<T[]>,
): Promise<T[]> {
  const chunk = BigInt(chunkBlocks());
  const results: T[] = [];
  for (let start = fromBlock; start <= toBlock; start += chunk + 1n) {
    const end = start + chunk < toBlock ? start + chunk : toBlock;
    results.push(...(await fn(start, end)));
  }
  return results;
}

export async function getTransferLogsForWallets(
  client: PublicClient,
  wallets: Address[],
  fromBlock: bigint,
  toBlock: bigint,
): Promise<TransferLog[]> {
  if (wallets.length === 0) return [];

  return inChunks(fromBlock, toBlock, async (from, to) => {
    const [asSender, asRecipient] = await Promise.all([
      client.getLogs({ event: transferEvent, args: { from: wallets }, fromBlock: from, toBlock: to, strict: true }),
      client.getLogs({ event: transferEvent, args: { to: wallets }, fromBlock: from, toBlock: to, strict: true }),
    ]);
    // A wallet-to-wallet transfer between two registered wallets would appear in
    // both queries; dedupe on (tx hash, log index).
    const seen = new Set<string>();
    const merged: TransferLog[] = [];
    for (const log of [...asSender, ...asRecipient]) {
      const key = `${log.transactionHash}:${log.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(log);
    }
    return merged;
  });
}

export async function getApprovalLogsForWallets(
  client: PublicClient,
  wallets: Address[],
  fromBlock: bigint,
  toBlock: bigint,
): Promise<ApprovalLog[]> {
  if (wallets.length === 0) return [];

  return inChunks(fromBlock, toBlock, (from, to) =>
    client.getLogs({ event: approvalEvent, args: { owner: wallets }, fromBlock: from, toBlock: to, strict: true }),
  );
}

// ERC-721/1155 ApprovalForAll — owner is the only indexed arg we filter on,
// same single-query shape as getApprovalLogsForWallets above.
export async function getApprovalForAllLogsForWallets(
  client: PublicClient,
  wallets: Address[],
  fromBlock: bigint,
  toBlock: bigint,
): Promise<ApprovalForAllLog[]> {
  if (wallets.length === 0) return [];

  return inChunks(fromBlock, toBlock, (from, to) =>
    client.getLogs({ event: approvalForAllEvent, args: { owner: wallets }, fromBlock: from, toBlock: to, strict: true }),
  );
}
