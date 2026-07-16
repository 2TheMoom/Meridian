import { NextRequest, NextResponse } from "next/server";
import type { RuleId } from "@/lib/oracle/types";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_RULE_IDS: RuleId[] = ["R1", "R2", "R3", "R4", "R5"];
const VALID_TIERS = ["off", "notify", "confirm"] as const;
const MAX_BODY_BYTES = 8192;

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

  const { data, error } = await supabase.from("policies").select("*").eq("wallet_id", walletId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byRule = new Map((data ?? []).map((row) => [row.rule_id as RuleId, row]));
  // Always return all five rules, defaulting anything without a row yet to
  // the DB's own default (tier 'notify', empty threshold) — the Guardrails
  // screen shouldn't have to special-case "no policy configured yet".
  const policies = VALID_RULE_IDS.map(
    (ruleId) => byRule.get(ruleId) ?? { wallet_id: walletId, rule_id: ruleId, tier: "notify", threshold: {} },
  );

  return NextResponse.json({ policies });
}

export async function PUT(req: NextRequest) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const walletId = req.nextUrl.searchParams.get("wallet");
  if (!walletId || !UUID_RE.test(walletId)) {
    return NextResponse.json({ error: "Invalid or missing wallet param" }, { status: 400 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  const policies = body?.policies;
  if (!Array.isArray(policies) || policies.length === 0) {
    return NextResponse.json({ error: "Invalid policies array" }, { status: 400 });
  }

  for (const policy of policies) {
    if (typeof policy !== "object" || policy === null) {
      return NextResponse.json({ error: "Invalid policy entry" }, { status: 400 });
    }
    if (!VALID_RULE_IDS.includes(policy.ruleId)) {
      return NextResponse.json({ error: `Invalid ruleId: ${policy.ruleId}` }, { status: 400 });
    }
    if (!VALID_TIERS.includes(policy.tier)) {
      return NextResponse.json({ error: `Invalid tier: ${policy.tier}` }, { status: 400 });
    }
    if (policy.threshold !== undefined && (typeof policy.threshold !== "object" || policy.threshold === null || Array.isArray(policy.threshold))) {
      return NextResponse.json({ error: "Invalid threshold" }, { status: 400 });
    }
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const rows = policies.map((policy: { ruleId: RuleId; tier: string; threshold?: Record<string, unknown> }) => ({
    wallet_id: walletId,
    rule_id: policy.ruleId,
    tier: policy.tier,
    threshold: policy.threshold ?? {},
  }));

  // RLS (policies: owner full access) rejects this outright if walletId
  // isn't one of the caller's own wallets — no separate ownership check
  // needed here.
  const { data, error } = await supabase.from("policies").upsert(rows, { onConflict: "wallet_id,rule_id" }).select();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policies: data });
}
