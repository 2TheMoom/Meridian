import type { Address, PublicClient } from "viem";
import { erc20DecimalsAbi } from "./abi";

// Decimals never change for a deployed contract, so an in-process cache is
// safe for the life of the worker. Serverless call sites (the sweep route)
// don't benefit across invocations, but the RPC cost is small either way.
const cache = new Map<string, number>();

export async function getTokenDecimals(
  client: PublicClient,
  addresses: Address[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const toFetch: Address[] = [];

  for (const address of addresses) {
    const key = address.toLowerCase();
    const cached = cache.get(key);
    if (cached !== undefined) result[key] = cached;
    else toFetch.push(address);
  }

  await Promise.all(
    toFetch.map(async (address) => {
      try {
        const decimals = await client.readContract({
          address,
          abi: [erc20DecimalsAbi],
          functionName: "decimals",
        });
        const key = address.toLowerCase();
        cache.set(key, decimals);
        result[key] = decimals;
      } catch {
        // Non-standard token without decimals() — skip. Its transfers just
        // won't contribute to outflow_usd, rather than failing the window.
      }
    }),
  );

  return result;
}
