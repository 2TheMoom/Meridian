import { NextRequest, NextResponse } from "next/server";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only user-initiated transitions. 'open' is the only creation state and
// 'acted' is reserved for Keel actually executing an on-chain remediation
// (Week 3) — a client should never be able to claim that happened via a
// plain status PATCH.
const USER_SETTABLE_STATUSES = ["acked", "dismissed"] as const;

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  return authHeader?.replace(/^Bearer\s+/i, "") ?? null;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid moment id" }, { status: 400 });
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data, error } = await supabase.from("moments").select("*").eq("id", id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ moment: data });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid moment id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (typeof status !== "string" || !USER_SETTABLE_STATUSES.includes(status as (typeof USER_SETTABLE_STATUSES)[number])) {
    return NextResponse.json({ error: `status must be one of: ${USER_SETTABLE_STATUSES.join(", ")}` }, { status: 400 });
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // RLS (moments: owner status update) enforces this only affects a moment
  // on a wallet the caller owns.
  const { data, error } = await supabase.from("moments").update({ status }).eq("id", id).select().maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ moment: data });
}
