import type { User } from "@supabase/supabase-js";

/**
 * Supabase stores a Web3 (SIWE) identity's `web3:{chain}:{address}` string
 * as the identity's `id` field (not `provider_id` — that field doesn't
 * exist on `UserIdentity`), and the raw address inside
 * `identity_data.custom_claims.address`. Extracting it from here (verified
 * server-side by Supabase's SIWE check at sign-in) is the only trustworthy
 * source of "which wallet did this user prove ownership of" — never trust
 * an address passed in a request body on its own.
 */
export function getVerifiedWeb3Address(user: User, chain: "ethereum" = "ethereum"): string | null {
  const identity = user.identities?.find((i) => i.provider === "web3");
  if (!identity) return null;

  const match = identity.id.match(/^web3:([a-z0-9]+):(0x[a-fA-F0-9]{40})$/i);
  if (match && match[1].toLowerCase() === chain) {
    return match[2].toLowerCase();
  }

  const addressFromData = (
    identity.identity_data as { custom_claims?: { address?: string } } | undefined
  )?.custom_claims?.address;
  return addressFromData ? addressFromData.toLowerCase() : null;
}
