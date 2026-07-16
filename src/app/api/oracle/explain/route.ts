import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedBySecret } from "@/lib/internalAuth";
import { explainMoment } from "@/lib/oracle/explain";
import type { RuleId } from "@/lib/oracle/types";

const VALID_RULE_IDS: RuleId[] = ["R1", "R2", "R3", "R4", "R5"];
const SUPPORTED_CHAIN_IDS = [143, 10143];
const MAX_BODY_BYTES = 8192;

/**
 * Internal only — never client-callable. The Horizon worker calls this after
 * Oracle's rules engine scores a Moment, to get plain-language copy for
 * moments.oracle_text. The worker persists the result itself; this route is
 * stateless. Never send the numeric score in the request body — explain.ts's
 * ExplanationInput type has no field for it, by design.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedBySecret(req, "x-oracle-secret", process.env.ORACLE_EXPLAIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ruleId, details, walletLabel, chainId } = body as Record<string, unknown>;

  if (typeof ruleId !== "string" || !VALID_RULE_IDS.includes(ruleId as RuleId)) {
    return NextResponse.json({ error: "Invalid ruleId" }, { status: 400 });
  }
  if (typeof details !== "object" || details === null || Array.isArray(details)) {
    return NextResponse.json({ error: "Invalid details" }, { status: 400 });
  }
  if (typeof chainId !== "number" || !SUPPORTED_CHAIN_IDS.includes(chainId)) {
    return NextResponse.json({ error: "Unsupported chainId" }, { status: 400 });
  }
  if (walletLabel !== null && walletLabel !== undefined && typeof walletLabel !== "string") {
    return NextResponse.json({ error: "Invalid walletLabel" }, { status: 400 });
  }

  const explanation = await explainMoment({
    ruleId: ruleId as RuleId,
    details: details as Record<string, unknown>,
    walletContext: { label: (walletLabel as string | null) ?? null, chainId },
  });

  return NextResponse.json({
    why: explanation.why,
    saferAlternative: explanation.saferAlternative,
    oracleText: `${explanation.why}\n\n${explanation.saferAlternative}`,
  });
}
