// Verified live against CoinGecko's API on 2026-07-16:
// GET https://api.coingecko.com/api/v3/asset_platforms -> Monad entry is
// {"id":"monad","chain_identifier":143,"name":"Monad","native_coin_id":"monad"}
// so the asset-platform id, the native coin id, and Monad's own chain ID all
// happen to be "monad" / 143 — not assumed, checked directly.
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const MONAD_PLATFORM_ID = "monad";
const MONAD_NATIVE_COIN_ID = "monad";

function authHeaders(): HeadersInit {
  // Public API works with no key (5-15 req/min, unreliable). A free Demo key
  // (COINGECKO_API_KEY) raises that to 100 req/min / 10k per month — no
  // billing required, just a signup. Recommended once this runs against
  // real wallet volume.
  const key = process.env.COINGECKO_API_KEY;
  return key ? { "x-cg-demo-api-key": key } : {};
}

export async function fetchNativePriceUsd(): Promise<number | null> {
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${MONAD_NATIVE_COIN_ID}&vs_currencies=usd`,
      { headers: authHeaders() },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, { usd?: number }>;
    return body[MONAD_NATIVE_COIN_ID]?.usd ?? null;
  } catch (err) {
    console.error("[pricing] fetchNativePriceUsd failed", err);
    return null;
  }
}

export async function fetchTokenPricesUsd(addresses: string[]): Promise<Record<string, number>> {
  if (addresses.length === 0) return {};

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/token_price/${MONAD_PLATFORM_ID}?contract_addresses=${addresses.join(",")}&vs_currencies=usd`,
      { headers: authHeaders() },
    );
    if (!res.ok) return {};

    const body = (await res.json()) as Record<string, { usd?: number }>;
    const result: Record<string, number> = {};
    for (const [address, prices] of Object.entries(body)) {
      if (prices.usd !== undefined) result[address.toLowerCase()] = prices.usd;
    }
    return result;
  } catch (err) {
    console.error("[pricing] fetchTokenPricesUsd failed", err);
    return {};
  }
}
