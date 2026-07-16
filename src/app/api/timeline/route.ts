import { NextRequest, NextResponse } from "next/server";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MOMENTS = 100;

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  return authHeader?.replace(/^Bearer\s+/i, "") ?? null;
}

export async function GET(req: NextRequest) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const walletId = req.nextUrl.searchParams.get("wallet");
  if (!walletId || !UUID_RE.test(walletId)) {
    return NextResponse.json({ error: "Invalid or missing wallet param" }, { status: 400 });
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // RLS (moments: owner read) already scopes this to wallets the caller
  // owns — a wallet ID that isn't theirs just returns an empty list, not
  // another user's data.
  const { data, error } = await supabase
    .from("moments")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(MAX_MOMENTS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ moments: data });
}
