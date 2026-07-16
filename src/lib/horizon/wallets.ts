import type { Address } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegisteredWallet } from "./window";

export async function getRegisteredWallets(
  supabase: SupabaseClient,
  chainId: number,
): Promise<RegisteredWallet[]> {
  const { data, error } = await supabase.from("wallets").select("id, address").eq("chain_id", chainId);
  if (error) throw new Error(`failed to load registered wallets: ${error.message}`);

  return (data ?? []).map((row: { id: string; address: string }) => ({
    id: row.id,
    address: row.address as Address,
  }));
}
