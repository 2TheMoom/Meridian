import type { Address } from "viem";
import type { TransferLog } from "./logs";

/**
 * Native outflow is a balance-delta approximation, not a transfer-log sum:
 * native transfers don't emit logs, so there is no way to trace exactly who
 * a wallet's outgoing MON went to (see spec section 4's "native balance
 * checks... at window close" framing). A balance drop between the prior
 * snapshot and this one is treated as outflow; a balance increase (net
 * inflow this window) is not treated as negative outflow, it's just floored
 * at zero.
 */
export function computeOutflowUsd(params: {
  walletAddress: Address;
  walletTransferLogs: TransferLog[];
  priorNativeBalance: bigint | null;
  currentNativeBalance: bigint;
  nativePriceUsd: number | null;
  tokenPricesUsd: Record<string, number>;
  tokenDecimals: Record<string, number>;
}): number {
  const addr = params.walletAddress.toLowerCase();
  let outflowUsd = 0;

  if (params.priorNativeBalance !== null && params.nativePriceUsd !== null) {
    const delta = params.priorNativeBalance - params.currentNativeBalance;
    if (delta > 0n) {
      outflowUsd += (Number(delta) / 1e18) * params.nativePriceUsd;
    }
  }

  const outgoingByToken = new Map<string, bigint>();
  for (const log of params.walletTransferLogs) {
    if (log.args.from.toLowerCase() !== addr) continue;
    const token = log.address.toLowerCase();
    outgoingByToken.set(token, (outgoingByToken.get(token) ?? 0n) + log.args.value);
  }

  for (const [token, amount] of outgoingByToken) {
    const price = params.tokenPricesUsd[token];
    const decimals = params.tokenDecimals[token];
    if (price === undefined || decimals === undefined) continue; // untracked/unknown token — skip, don't guess
    outflowUsd += (Number(amount) / 10 ** decimals) * price;
  }

  return outflowUsd;
}
