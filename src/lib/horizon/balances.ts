import type { Address, PublicClient } from "viem";
import { erc20BalanceOfAbi } from "./abi";

export type WalletBalances = {
  native: string;
  tokens: Record<string, string>; // token address (lowercase) -> raw balance string
};

/**
 * Native balance always, plus balances for any ERC-20 token contracts the
 * wallet touched in this window (from Transfer/Approval logs). A full
 * every-token-every-window sweep isn't worth the RPC cost; floor-breach and
 * approval checks only need tokens the wallet is actually active in.
 */
export async function getWalletBalances(
  client: PublicClient,
  wallet: Address,
  touchedTokenAddresses: Address[],
): Promise<WalletBalances> {
  const native = await client.getBalance({ address: wallet });

  const uniqueTokens = [...new Set(touchedTokenAddresses.map((a) => a.toLowerCase()))] as Address[];
  const tokenBalances = await Promise.all(
    uniqueTokens.map(async (token) => {
      try {
        const balance = await client.readContract({
          address: token,
          abi: [erc20BalanceOfAbi],
          functionName: "balanceOf",
          args: [wallet],
        });
        return [token, balance.toString()] as const;
      } catch {
        // Non-standard or self-destructed token contract; skip rather than fail the window.
        return null;
      }
    }),
  );

  const tokens: Record<string, string> = {};
  for (const entry of tokenBalances) {
    if (entry) tokens[entry[0]] = entry[1];
  }

  return { native: native.toString(), tokens };
}
