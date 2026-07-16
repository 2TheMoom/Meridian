import Anthropic from "@anthropic-ai/sdk";
import type { RuleId } from "./types";

const MODEL = "claude-sonnet-5";

// Frozen and cache-friendly: this exact text is reused on every explanation
// call, so it sits before the volatile per-Moment content and gets served
// from cache (see prompt-caching § placement patterns).
const SYSTEM_PROMPT = `You are Oracle, the explanation layer for Meridian, a wallet-safety product on Monad.

A deterministic rules engine has already flagged a "Moment" (a risky or regrettable on-chain event) and computed its severity. You do not see that severity, and you must never guess, state, or imply a numeric score, risk level, or ranking. Your only job is to explain, in plain language, why this looks regrettable and what the safer response is, from the raw facts you're given.

Respond in exactly two parts:
1. "why": one or two sentences, plain language, explaining why this looks regrettable given the facts provided.
2. "saferAlternative": one or two sentences, the safer response.

"saferAlternative" must be restraint-oriented only: revoke, pause, cap, or wait. Never suggest leverage, yield-chasing, hedging, or any other speculative repositioning. Meridian counsels restraint, not alternative financial strategies.

Do not use em dashes. Do not mention or imply any numeric score. Do not add content beyond the two required sentences per part.`;

export type ExplanationInput = {
  ruleId: RuleId;
  // Deliberately typed as RuleResult["details"], never RuleResult itself —
  // this is the enforcement point for "never let the LLM see the score."
  details: Record<string, unknown>;
  walletContext: {
    label: string | null;
    chainId: number;
  };
};

export type Explanation = {
  why: string;
  saferAlternative: string;
};

const explanationSchema = {
  type: "object" as const,
  properties: {
    why: { type: "string" as const },
    saferAlternative: { type: "string" as const },
  },
  required: ["why", "saferAlternative"],
  additionalProperties: false,
};

// Defense in depth: the system prompt is the primary control, this is a
// backstop in case the model drifts. A match falls back to a deterministic,
// on-brand template rather than either failing the Moment or shipping
// off-principle copy — see FALLBACK_EXPLANATIONS below.
const RESTRAINT_VIOLATION_PATTERNS = [
  /leverage/i,
  /yield[\s-]?farm/i,
  /\bmargin\b/i,
  /\bhedg(e|ing)\b/i,
  /\bmoon(ing)?\b/i,
  /\bape\s?(in|into)\b/i,
  /\bshort(ing)?\s+(the|this|it)\b/i,
  /\blong(ing)?\s+(the|this|it)\b/i,
  /re-?position/i,
];

const EM_DASH = /[—–]/; // em dash, en dash

export const FALLBACK_EXPLANATIONS: Record<RuleId, Explanation> = {
  R1: {
    why: "This approval is not limited to what you are spending right now, so a compromised or malicious contract could drain far more than intended.",
    saferAlternative: "Consider revoking this approval or capping it to the amount you actually need.",
  },
  R2: {
    why: "Your outflow this week is well above your typical spending pattern for this wallet.",
    saferAlternative: "Consider pausing new outgoing transactions until you have reviewed what is driving the spike.",
  },
  R3: {
    why: "This recurring payment has not been marked as intentional and keeps repeating.",
    saferAlternative: "Acknowledge it if it is expected, or pause it if it is not.",
  },
  R4: {
    why: "This is the first time this wallet has interacted with this contract, and value or an approval was attached.",
    saferAlternative: "Consider waiting and researching the contract before interacting with it again.",
  },
  R5: {
    why: "Your balance has dropped below the floor you set, or is on track to at the current rate of spending.",
    saferAlternative: "Consider pausing outgoing transactions until your balance recovers.",
  },
};

export function violatesRestraintPrinciple(explanation: Explanation): boolean {
  const text = `${explanation.why} ${explanation.saferAlternative}`;
  return RESTRAINT_VIOLATION_PATTERNS.some((pattern) => pattern.test(text)) || EM_DASH.test(text);
}

export function isValidExplanation(value: unknown): value is Explanation {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Explanation).why === "string" &&
    (value as Explanation).why.length > 0 &&
    typeof (value as Explanation).saferAlternative === "string" &&
    (value as Explanation).saferAlternative.length > 0
  );
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Calls Claude to narrate a Moment that Oracle's rules engine already
 * scored. Never sends the score, and falls back to a deterministic,
 * on-brand template if the call fails or the response drifts off the
 * restraint-only product principle (see spec section 6).
 */
export async function explainMoment(input: ExplanationInput): Promise<Explanation> {
  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      thinking: { type: "disabled" }, // short, bounded, templated task — no reasoning depth needed
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: explanationSchema },
      },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            ruleId: input.ruleId,
            details: input.details,
            walletLabel: input.walletContext.label,
            chainId: input.walletContext.chainId,
          }),
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return FALLBACK_EXPLANATIONS[input.ruleId];
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return FALLBACK_EXPLANATIONS[input.ruleId];
    }

    const parsed: unknown = JSON.parse(textBlock.text);
    if (!isValidExplanation(parsed)) {
      return FALLBACK_EXPLANATIONS[input.ruleId];
    }
    if (violatesRestraintPrinciple(parsed)) {
      console.warn(`[oracle] explanation for ${input.ruleId} failed restraint-principle check, using fallback`);
      return FALLBACK_EXPLANATIONS[input.ruleId];
    }

    return parsed;
  } catch (err) {
    console.error("[oracle] explanation call failed, using fallback", err);
    return FALLBACK_EXPLANATIONS[input.ruleId];
  }
}
