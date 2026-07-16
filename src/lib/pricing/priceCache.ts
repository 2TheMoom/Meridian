import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchNativePriceUsd, fetchTokenPricesUsd } from "./coingecko";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const NATIVE_KEY = "native";
const MONAD_MAINNET_CHAIN_ID = 143;

export type PriceLookup = { native: number | null; tokens: Record<string, number> };

async function readFreshCache(
  supabase: SupabaseClient,
  keys: string[],
  chainId: number,
): Promise<Record<string, number>> {
  if (keys.length === 0) return {};

  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("price_cache")
    .select("key, usd_price")
    .eq("chain_id", chainId)
    .in("key", keys)
    .gte("updated_at", cutoff);

  if (error) throw new Error(`price cache read failed: ${error.message}`);

  const result: Record<string, number> = {};
  for (const row of (data ?? []) as { key: string; usd_price: number }[]) {
    result[row.key] = Number(row.usd_price);
  }
  return result;
}

async function writeCache(
  supabase: SupabaseClient,
  chainId: number,
  prices: Record<string, number>,
): Promise<void> {
  const rows = Object.entries(prices).map(([key, usd_price]) => ({
    key,
    chain_id: chainId,
    usd_price,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;

  const { error } = await supabase.from("price_cache").upsert(rows, { onConflict: "key,chain_id" });
  if (error) throw new Error(`price cache write failed: ${error.message}`);
}

/**
 * Cached USD prices for the chain's native token and a set of ERC-20
 * contract addresses. Testnet always returns empty — Monad testnet MON and
 * testnet tokens have no real market, so pretending otherwise would produce
 * fake outflow_usd figures. Missing entries (a token CoinGecko doesn't
 * track, or a CoinGecko outage) are simply absent from the result, not an
 * error — callers should treat an absent price as "can't value this token
 * right now," not zero.
 */
export async function getPricesUsd(
  supabase: SupabaseClient,
  chainId: number,
  tokenAddresses: string[],
): Promise<PriceLookup> {
  if (chainId !== MONAD_MAINNET_CHAIN_ID) return { native: null, tokens: {} };

  const lowerAddresses = [...new Set(tokenAddresses.map((a) => a.toLowerCase()))];
  const keys = [NATIVE_KEY, ...lowerAddresses];
  const fresh = await readFreshCache(supabase, keys, chainId);

  const toWrite: Record<string, number> = {};

  if (!(NATIVE_KEY in fresh)) {
    const price = await fetchNativePriceUsd();
    if (price !== null) toWrite[NATIVE_KEY] = price;
  }

  const missingTokens = lowerAddresses.filter((a) => !(a in fresh));
  if (missingTokens.length > 0) {
    const fetched = await fetchTokenPricesUsd(missingTokens);
    Object.assign(toWrite, fetched);
  }

  if (Object.keys(toWrite).length > 0) {
    await writeCache(supabase, chainId, toWrite);
  }

  const merged = { ...fresh, ...toWrite };
  const { [NATIVE_KEY]: native, ...tokens } = merged;
  return { native: native ?? null, tokens };
}
