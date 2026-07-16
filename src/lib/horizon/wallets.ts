import type { Address } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegisteredWallet } from "./window";

export async function getRegisteredWallets(
  supabase: SupabaseClient,
  chainId: number,
): Promise<RegisteredWallet[]> {
  const { data, error } = await supabase.from("wallets").select("id, address, label").eq("chain_id", chainId);
  if (error) throw new Error(`failed to load registered wallets: ${error.message}`);

  return (data ?? []).map((row: { id: string; address: string; label: string | null }) => ({
    id: row.id,
    address: row.address as Address,
    label: row.label,
  }));
}
