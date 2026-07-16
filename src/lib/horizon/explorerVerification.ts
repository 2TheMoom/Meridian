import type { Address } from "viem";

// Verified against Etherscan's live chainlist on 2026-07-16:
// GET https://api.etherscan.io/v2/chainlist -> "Monad Mainnet", chainid 143,
// explorer monadscan.com. MonadScan's own API docs (docs.monadscan.com)
// redirect to Etherscan's V2 docs — MonadScan is served through Etherscan's
// unified multichain API, not a separate host.
const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";

// Verification status essentially never changes back to unverified once
// set, and rarely flips at all within a session — cache indefinitely per
// process, same tradeoff as decimals.ts and contractAge.ts.
const cache = new Map<string, boolean>();

type GetSourceCodeResult = { SourceCode?: string };
type GetSourceCodeResponse = { status: string; result: GetSourceCodeResult[] | string };

/**
 * Whether a contract's source is published/verified on the block explorer,
 * for R4's "unverified source" signal. Returns null (unknown) rather than
 * `false` when there's no API key configured or the lookup fails — R4 only
 * ever treats an explicit `false` as a penalty, never an unknown, so a
 * missing key degrades to "no bonus," not a false accusation.
 */
export async function getVerificationStatus(chainId: number, address: Address): Promise<boolean | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return null;

  const key = `${chainId}:${address.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  try {
    const url = new URL(ETHERSCAN_V2_BASE);
    url.searchParams.set("chainid", String(chainId));
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "getsourcecode");
    url.searchParams.set("address", address);
    url.searchParams.set("apikey", apiKey);

    const res = await fetch(url);
    if (!res.ok) return null;

    const body = (await res.json()) as GetSourceCodeResponse;
    if (!Array.isArray(body.result) || body.result.length === 0) return null;

    const verified = typeof body.result[0].SourceCode === "string" && body.result[0].SourceCode.length > 0;
    cache.set(key, verified);
    return verified;
  } catch (err) {
    console.error(`[horizon] verification lookup failed for ${address}`, err);
    return null;
  }
}
