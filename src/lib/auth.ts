import type { User } from "@supabase/supabase-js";

/**
 * Supabase stores a Web3 (SIWE) identity's provider_id as `web3:{chain}:{address}`.
 * Extracting the address from here (verified server-side by Supabase's SIWE check
 * at sign-in) is the only trustworthy source of "which wallet did this user prove
 * ownership of" — never trust an address passed in a request body on its own.
 */
export function getVerifiedWeb3Address(user: User, chain: "ethereum" = "ethereum"): string | null {
  const identity = user.identities?.find((i) => i.provider === "web3");
  if (!identity) return null;

  const providerId = (identity as unknown as { provider_id?: string }).provider_id;
  const match = providerId?.match(/^web3:([a-z0-9]+):(0x[a-fA-F0-9]{40})$/i);
  if (match && match[1].toLowerCase() === chain) {
    return match[2].toLowerCase();
  }

  const addressFromData = (identity.identity_data as { address?: string } | undefined)?.address;
  return addressFromData ? addressFromData.toLowerCase() : null;
}
