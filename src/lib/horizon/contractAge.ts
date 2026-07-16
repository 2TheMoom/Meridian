import type { Address, PublicClient } from "viem";

// Deployment block never changes for a given contract, so this is safe to
// cache indefinitely for the life of the process — same pattern as
// decimals.ts.
const deploymentBlockCache = new Map<string, number | null>();

/**
 * Binary-searches for the first block at which `address` has contract code,
 * using only `eth_getCode` — no third-party API or API key required, and no
 * dependency on an explorer having indexed the contract. Requires the RPC
 * endpoint to serve historical state (an archive node, or a provider that
 * behaves like one) for `eth_getCode` at arbitrary past block numbers; on a
 * pruned/light node this will error, which callers should treat as "age
 * unknown," not as evidence the contract is new.
 *
 * O(log2(currentBlock)) sequential RPC round trips the first time a given
 * address is seen — a few dozen calls at Monad's current block height, which
 * is only acceptable because the result is cached forever after.
 */
async function findDeploymentBlock(client: PublicClient, address: Address): Promise<number | null> {
  const currentBlock = await client.getBlockNumber();

  const hasCodeAt = async (blockNumber: bigint): Promise<boolean> => {
    const code = await client.getCode({ address, blockNumber });
    return code !== undefined && code !== "0x";
  };

  if (!(await hasCodeAt(currentBlock))) return null; // not a contract as of the current head

  let lo = 0n;
  let hi = currentBlock;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (await hasCodeAt(mid)) {
      hi = mid;
    } else {
      lo = mid + 1n;
    }
  }
  return Number(lo);
}

/**
 * Contract age in days, for R1/R4's "young contract" bonus. Returns null
 * (unknown — never treated as a penalty on its own, per both rules'
 * design) if the address isn't a contract, or if the lookup fails for any
 * reason (e.g. a non-archive RPC endpoint).
 */
export async function getContractAgeDays(client: PublicClient, address: Address): Promise<number | null> {
  const key = address.toLowerCase();

  try {
    let deployBlock = deploymentBlockCache.get(key);
    if (deployBlock === undefined) {
      deployBlock = await findDeploymentBlock(client, address as Address);
      deploymentBlockCache.set(key, deployBlock);
    }
    if (deployBlock === null) return null;

    const block = await client.getBlock({ blockNumber: BigInt(deployBlock) });
    const ageSeconds = Date.now() / 1000 - Number(block.timestamp);
    return ageSeconds / 86_400;
  } catch (err) {
    console.error(`[horizon] contract age lookup failed for ${address}`, err);
    return null;
  }
}
