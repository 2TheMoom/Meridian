import { isAddress } from "viem";
import { NextRequest, NextResponse } from "next/server";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const address = body?.address as string | undefined;
  const chainId = (body?.chainId as number | undefined) ?? 143;
  const label = (body?.label as string | null | undefined) ?? null;

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("wallets")
    .insert({ user_id: user.id, address: address.toLowerCase(), chain_id: chainId, label })
    .select()
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ wallet: data }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data, error } = await supabase.from("wallets").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallets: data });
}
