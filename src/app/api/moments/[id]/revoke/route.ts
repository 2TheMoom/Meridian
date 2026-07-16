import { createPublicClient, decodeFunctionData, http } from "viem";
import { NextRequest, NextResponse } from "next/server";
import { erc20ApproveAbi, setApprovalForAllAbi } from "@/lib/horizon/abi";
import { monad, monadTestnet } from "@/lib/chain";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TX_HASH_RE = /^0x[0-9a-f]{64}$/i;

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  return authHeader?.replace(/^Bearer\s+/i, "") ?? null;
}

function clientFor(chainId: number) {
  const chain = chainId === 143 ? monad : monadTestnet;
  return createPublicClient({ chain, transport: http() });
}

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Records a Confirm-tier revoke action against an R1 (risky approval) or R6
 * (NFT approval risk) Moment. Never trusts the client's word that a revoke
 * happened — it fetches the transaction from-chain and checks it actually is
 * the right revoke call (`approve(spender, 0)` for R1, `setApprovalForAll
 * (operator, false)` for R6) on the flagged contract, sent from the wallet
 * the Moment belongs to, before marking the Moment `acted`. This is the only
 * path in the app allowed to set that status (see /api/moments/[id]'s PATCH,
 * which explicitly excludes it).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid moment id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const txHash = body?.txHash;
  if (typeof txHash !== "string" || !TX_HASH_RE.test(txHash)) {
    return NextResponse.json({ error: "Invalid txHash" }, { status: 400 });
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: moment, error: momentError } = await supabase
    .from("moments")
    .select("id, wallet_id, rule_id, status, context")
    .eq("id", id)
    .maybeSingle();
  if (momentError) {
    return NextResponse.json({ error: momentError.message }, { status: 500 });
  }
  if (!moment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (moment.rule_id !== "R1" && moment.rule_id !== "R6") {
    return NextResponse.json(
      { error: "Revoke only applies to R1 (risky approval) and R6 (NFT approval risk) moments" },
      { status: 400 },
    );
  }
  if (moment.status !== "open") {
    return NextResponse.json({ error: "Moment is not open" }, { status: 409 });
  }

  const context = moment.context as { token?: string; spender?: string };
  if (!context.token || !context.spender) {
    return NextResponse.json({ error: "Moment is missing token/spender context" }, { status: 400 });
  }

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("address, chain_id")
    .eq("id", moment.wallet_id)
    .maybeSingle();
  if (walletError || !wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  const client = clientFor(wallet.chain_id);
  const hash = txHash as `0x${string}`;

  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;
  let tx: Awaited<ReturnType<typeof client.getTransaction>>;
  try {
    [receipt, tx] = await Promise.all([
      client.getTransactionReceipt({ hash }),
      client.getTransaction({ hash }),
    ]);
  } catch {
    return NextResponse.json({ error: "Transaction not found on-chain yet" }, { status: 400 });
  }

  if (receipt.status !== "success") {
    return NextResponse.json({ error: "Transaction did not succeed" }, { status: 400 });
  }
  if (tx.from.toLowerCase() !== wallet.address.toLowerCase()) {
    return NextResponse.json({ error: "Transaction was not sent from this wallet" }, { status: 400 });
  }
  if (!tx.to || tx.to.toLowerCase() !== context.token.toLowerCase()) {
    return NextResponse.json({ error: "Transaction was not sent to the flagged contract" }, { status: 400 });
  }

  if (moment.rule_id === "R1") {
    try {
      const decoded = decodeFunctionData({ abi: [erc20ApproveAbi], data: tx.input });
      const [spender, amount] = decoded.args;
      if (decoded.functionName !== "approve" || spender.toLowerCase() !== context.spender.toLowerCase() || amount !== 0n) {
        return NextResponse.json(
          { error: "Transaction is not an approve(spender, 0) call for the flagged spender" },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Could not decode transaction as an ERC-20 approve call" }, { status: 400 });
    }
  } else {
    try {
      const decoded = decodeFunctionData({ abi: [setApprovalForAllAbi], data: tx.input });
      const [operator, approved] = decoded.args;
      if (
        decoded.functionName !== "setApprovalForAll" ||
        operator.toLowerCase() !== context.spender.toLowerCase() ||
        approved !== false
      ) {
        return NextResponse.json(
          { error: "Transaction is not a setApprovalForAll(operator, false) call for the flagged operator" },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Could not decode transaction as a setApprovalForAll call" }, { status: 400 });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("moments")
    .update({ status: "acted", tx_ref: hash })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ moment: updated });
}
