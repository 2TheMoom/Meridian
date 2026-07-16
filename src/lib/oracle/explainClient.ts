import type { ExplainFn, ExplanationInput } from "./explain";

/**
 * The Railway worker never holds ANTHROPIC_API_KEY — only the Next.js app
 * does (see .env.example). This calls the app's internal /api/oracle/explain
 * route instead of the Anthropic API directly, per spec section 9's stated
 * "internal, worker -> Claude API" flow.
 */
export function createExplainHttpClient(baseUrl: string, secret: string): ExplainFn {
  return async (input: ExplanationInput) => {
    const res = await fetch(new URL("/api/oracle/explain", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-oracle-secret": secret },
      body: JSON.stringify({
        ruleId: input.ruleId,
        details: input.details,
        walletLabel: input.walletContext.label,
        chainId: input.walletContext.chainId,
      }),
    });

    if (!res.ok) {
      throw new Error(`oracle explain request failed: ${res.status} ${await res.text().catch(() => "")}`);
    }

    const body = (await res.json()) as { oracleText: string };
    return { oracleText: body.oracleText };
  };
}
