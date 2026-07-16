import { isAddress } from "viem";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedWeb3Address } from "@/lib/auth";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server";

const SUPPORTED_CHAIN_IDS = [143, 10143] as const;
const MAX_LABEL_LENGTH = 64;
const MAX_BODY_BYTES = 2048;
const MAX_WALLETS_PER_USER = 10;

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  return authHeader?.replace(/^Bearer\s+/i, "") ?? null;
}

export async function POST(req: NextRequest) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const address = body.address;
  const chainId = body.chainId ?? 143;
  const label = body.label ?? null;

  if (typeof address !== "string" || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  if (typeof chainId !== "number" || !SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number])) {
    return NextResponse.json({ error: "Unsupported chainId" }, { status: 400 });
  }
  if (label !== null && (typeof label !== "string" || label.length > MAX_LABEL_LENGTH)) {
    return NextResponse.json({ error: "Invalid label" }, { status: 400 });
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Ownership check: only allow registering the address the user actually
  // signed the SIWE message with, never an arbitrary address from the body.
  const verifiedAddress = getVerifiedWeb3Address(user);
  if (!verifiedAddress || verifiedAddress !== address.toLowerCase()) {
    return NextResponse.json(
      { error: "Address does not match the wallet you signed in with" },
      { status: 403 },
    );
  }

  const { count, error: countError } = await supabase
    .from("wallets")
    .select("id", { count: "exact", head: true });

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_WALLETS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_WALLETS_PER_USER} registered wallets per account` },
      { status: 429 },
    );
  }

  const { data, error } = await supabase
    .from("wallets")
    .insert({ user_id: user.id, address: verifiedAddress, chain_id: chainId, label })
    .select()
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ wallet: data }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data, error } = await supabase.from("wallets").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallets: data });
}
