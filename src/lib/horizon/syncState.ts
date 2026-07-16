import type { SupabaseClient } from "@supabase/supabase-js";

export async function getLastProcessedBlock(
  supabase: SupabaseClient,
  walletId: string,
): Promise<bigint | null> {
  const { data, error } = await supabase
    .from("sync_state")
    .select("last_processed_block")
    .eq("wallet_id", walletId)
    .maybeSingle();

  if (error) throw new Error(`sync_state read failed for ${walletId}: ${error.message}`);
  if (!data) return null;
  return BigInt(data.last_processed_block);
}

export async function setLastProcessedBlock(
  supabase: SupabaseClient,
  walletId: string,
  block: bigint,
): Promise<void> {
  const { error } = await supabase
    .from("sync_state")
    .upsert(
      { wallet_id: walletId, last_processed_block: block.toString(), updated_at: new Date().toISOString() },
      { onConflict: "wallet_id" },
    );

  if (error) throw new Error(`sync_state write failed for ${walletId}: ${error.message}`);
}
