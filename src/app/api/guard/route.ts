import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http, isAddress } from "viem";
import { NextRequest, NextResponse } from "next/server";
import { getContractAgeDays } from "@/lib/horizon/contractAge";
import { getVerificationStatus } from "@/lib/horizon/explorerVerification";
import { evaluateGuard } from "@/lib/oracle/guard";
import { explainGuardCheck } from "@/lib/oracle/explain";
import { monad, monadTestnet } from "@/lib/chain";

const SUPPORTED_CHAIN_IDS = [143, 10143] as const;

function clientFor(chainId: number) {
  const chain = chainId === 143 ? monad : monadTestnet;
  return createPublicClient({ chain, transport: http() });
}

// Deliberately the anon key, not the service role — Guard is the one
// route in the app meant to work for anyone, signed in or not, before
// they've connected a wallet at all. It only ever reads the allowlist,
// which is public reference data (see migration 0007).
function anonSupabaseClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/**
 * The proactive half of Meridian: score a contract/spender address before
 * you approve it, not after. Reuses the exact same age/verification/
 * allowlist signals R1 and R6 score after the fact, and the same
 * restraint-oriented explanation layer — see lib/oracle/guard.ts for why
 * the verdict bands differ from a post-hoc Moment's.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const chainIdParam = req.nextUrl.searchParams.get("chainId");
  const chainId = chainIdParam ? Number(chainIdParam) : 143;

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number])) {
    return NextResponse.json({ error: "Unsupported chainId" }, { status: 400 });
  }

  const client = clientFor(chainId);
  const supabase = anonSupabaseClient();

  const [contractAgeDays, verifiedOnExplorer, allowlistRow] = await Promise.all([
    getContractAgeDays(client, address),
    getVerificationStatus(chainId, address),
    supabase.from("allowlist").select("address").eq("chain_id", chainId).eq("address", address.toLowerCase()).maybeSingle(),
  ]);

  const allowlisted = Boolean(allowlistRow.data);
  const result = evaluateGuard({ contractAgeDays, allowlisted, verifiedOnExplorer });

  const explanation =
    result.verdict === "safe"
      ? null
      : await explainGuardCheck({
          ruleId: result.ruleId,
          details: result.details,
          walletContext: { label: null, chainId },
        });

  return NextResponse.json({
    address: address.toLowerCase(),
    chainId,
    contractAgeDays,
    verifiedOnExplorer,
    allowlisted,
    verdict: result.verdict,
    score: result.score,
    explanation,
  });
}
