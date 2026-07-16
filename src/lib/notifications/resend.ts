// Raw fetch against Resend's REST API rather than their SDK — one POST call,
// not worth a new dependency for. Verified shape:
// https://resend.com/docs/api-reference/emails/send-email
const RESEND_API_URL = "https://api.resend.com/emails";

export type MomentEmailInput = {
  to: string;
  ruleLabel: string;
  score: number;
  oracleText: string;
  walletLabel: string | null;
  walletAddress: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Fire-and-log: a failed notification must never block Moment creation
 * (Horizon/Oracle's job is already done and durable by the time this runs) —
 * callers should not await this on the critical path, just log the outcome.
 */
export async function sendMomentNotification(input: MomentEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[notifications] RESEND_API_KEY or RESEND_FROM_EMAIL not set, skipping email");
    return false;
  }

  const walletDisplay = input.walletLabel ?? `${input.walletAddress.slice(0, 6)}...${input.walletAddress.slice(-4)}`;
  const [why, saferAlternative] = input.oracleText.split("\n\n");

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: `Meridian: ${input.ruleLabel} on ${walletDisplay}`,
        html: `
          <p><strong>${escapeHtml(input.ruleLabel)}</strong> flagged on ${escapeHtml(walletDisplay)}.</p>
          <p>${escapeHtml(why ?? input.oracleText)}</p>
          ${saferAlternative ? `<p>${escapeHtml(saferAlternative)}</p>` : ""}
          <p style="color:#888;font-size:12px;">This is an automated notice from Meridian. Manage guardrails in the app.</p>
        `,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[notifications] Resend send failed", err);
    return false;
  }
}
