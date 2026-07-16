import { timingSafeEqual } from "crypto";
import { createPublicClient, http, type PublicClient } from "viem";
import { NextRequest, NextResponse } from "next/server";
import { monad, monadTestnet } from "@/lib/chain";
import { getLastProcessedBlock } from "@/lib/horizon/syncState";
import { getRegisteredWallets } from "@/lib/horizon/wallets";
import { processWindow } from "@/lib/horizon/window";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const CONFIRMATION_DEPTH = 3n;
const MAX_BLOCKS_PER_INVOCATION = BigInt(process.env.HORIZON_SWEEP_MAX_BLOCKS ?? 5000);

function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get("x-horizon-secret");
  const expected = process.env.HORIZON_SWEEP_SECRET;
  if (!provided || !expected) return false;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

function clientFor(chainId: number): PublicClient {
  const chain = chainId === 143 ? monad : monadTestnet;
  return createPublicClient({ chain, transport: http() });
}

async function sweepChain(supabase: ReturnType<typeof createServiceRoleSupabaseClient>, chainId: number) {
  const wallets = await getRegisteredWallets(supabase, chainId);
  if (wallets.length === 0) return { chainId, walletsSwept: 0 };

  const client = clientFor(chainId);
  const head = await client.getBlockNumber();
  const confirmedHead = head > CONFIRMATION_DEPTH ? head - CONFIRMATION_DEPTH : 0n;

  let swept = 0;
  for (const wallet of wallets) {
    const last = await getLastProcessedBlock(supabase, wallet.id);
    const from = (last ?? confirmedHead - 1n) + 1n;
    if (from > confirmedHead) continue;

    const to = confirmedHead - from > MAX_BLOCKS_PER_INVOCATION ? from + MAX_BLOCKS_PER_INVOCATION : confirmedHead;
    await processWindow(supabase, client, [wallet], from, to);
    swept += 1;
  }

  return { chainId, walletsSwept: swept };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleSupabaseClient();

  try {
    const results = await Promise.all([sweepChain(supabase, 143), sweepChain(supabase, 10143)]);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sweep error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
