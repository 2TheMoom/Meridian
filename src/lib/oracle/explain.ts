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
  R6: {
    why: "You gave this address blanket control over your entire NFT collection, not just one item, so it could move any of them at any time.",
    saferAlternative: "Consider revoking this approval unless you specifically intended to grant ongoing access.",
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
 * Shared by explainMoment (a Moment already happened, past tense) and
 * explainGuardCheck (nothing has happened yet, forward-looking) — same
 * calling/validation/fallback mechanics, different system prompt and
 * fallback copy per caller, since the two contexts can't share tense
 * without producing factually wrong text in one of them.
 */
async function callExplainModel(
  systemPrompt: string,
  input: ExplanationInput,
  fallbacks: Record<RuleId, Explanation>,
): Promise<Explanation> {
  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      thinking: { type: "disabled" }, // short, bounded, templated task — no reasoning depth needed
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: explanationSchema },
      },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
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
      return fallbacks[input.ruleId];
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return fallbacks[input.ruleId];
    }

    const parsed: unknown = JSON.parse(textBlock.text);
    if (!isValidExplanation(parsed)) {
      return fallbacks[input.ruleId];
    }
    if (violatesRestraintPrinciple(parsed)) {
      console.warn(`[oracle] explanation for ${input.ruleId} failed restraint-principle check, using fallback`);
      return fallbacks[input.ruleId];
    }

    return parsed;
  } catch (err) {
    console.error("[oracle] explanation call failed, using fallback", err);
    return fallbacks[input.ruleId];
  }
}

/**
 * Calls Claude to narrate a Moment that Oracle's rules engine already
 * scored. Never sends the score, and falls back to a deterministic,
 * on-brand template if the call fails or the response drifts off the
 * restraint-only product principle (see spec section 6).
 */
export async function explainMoment(input: ExplanationInput): Promise<Explanation> {
  return callExplainModel(SYSTEM_PROMPT, input, FALLBACK_EXPLANATIONS);
}

const GUARD_SYSTEM_PROMPT = `You are Guard, the pre-sign explanation layer for Meridian, a wallet-safety product on Monad.

A deterministic check has evaluated a contract or spender address the user is considering approving — nothing has been signed or approved yet. You do not see the numeric verdict, and you must never guess, state, or imply a numeric score, risk level, or ranking. Your only job is to explain, in plain language and strictly forward-looking tense (this WOULD be risky if approved, not this IS or WAS), why approving this address would be worth hesitating over, from the raw facts you're given.

Respond in exactly two parts:
1. "why": one or two sentences, plain language, forward-looking, explaining why approving this address would be worth hesitating over given the facts provided.
2. "saferAlternative": one or two sentences, what to do instead of approving as-is.

"saferAlternative" must be restraint-oriented only: wait, research further, grant a capped/limited approval instead of unlimited, or decline. Never suggest leverage, yield-chasing, hedging, or any other speculative repositioning. Meridian counsels restraint, not alternative financial strategies.

Do not use em dashes. Do not mention or imply any numeric score. Do not add content beyond the two required sentences per part. Never phrase this as if the approval already happened — it has not.`;

const GUARD_FALLBACK_EXPLANATIONS: Record<RuleId, Explanation> = {
  R1: {
    why: "Approving this address without a limit would let it move far more than you intend to spend right now, especially if the contract is unproven or unverified.",
    saferAlternative: "Grant a capped approval for only what you need instead, or wait and research the contract further.",
  },
  R2: FALLBACK_EXPLANATIONS.R2,
  R3: FALLBACK_EXPLANATIONS.R3,
  R4: {
    why: "You have not interacted with this contract before, and it has not been reviewed against Meridian's allowlist.",
    saferAlternative: "Consider waiting and researching the contract before sending value or approving it.",
  },
  R5: FALLBACK_EXPLANATIONS.R5,
  R6: {
    why: "Approving this address would give it blanket control over your entire NFT collection, not just one item, so it could move any of them at any time.",
    saferAlternative: "Decline for now, or only grant access at the moment you actually need it for a specific transaction.",
  },
};

/**
 * Guard's counterpart to explainMoment — same mechanics, forward-looking
 * framing, since nothing has actually happened yet at the point Guard runs.
 */
export async function explainGuardCheck(input: ExplanationInput): Promise<Explanation> {
  return callExplainModel(GUARD_SYSTEM_PROMPT, input, GUARD_FALLBACK_EXPLANATIONS);
}

// Common interface for anything that can produce moments.oracle_text from an
// ExplanationInput — lets the pipeline stay agnostic to whether it's calling
// Claude in-process (Next.js server, holds ANTHROPIC_API_KEY) or over HTTP
// (the Railway worker, which deliberately does not — see explainClient.ts).
export type ExplainFn = (input: ExplanationInput) => Promise<{ oracleText: string }>;

export const explainMomentDirect: ExplainFn = async (input) => {
  const explanation = await explainMoment(input);
  return { oracleText: `${explanation.why}\n\n${explanation.saferAlternative}` };
};
