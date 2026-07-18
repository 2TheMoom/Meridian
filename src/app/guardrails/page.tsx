"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { AppHeader } from "@/components/layout/AppHeader";
import { AuthGate } from "@/components/AuthGate";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { WalletSelect } from "@/components/WalletSelect";
import { useAuthedFetch } from "@/hooks/useAuthedFetch";
import { RULE_LABELS } from "@/lib/oracle/labels";
import type { RuleId } from "@/lib/oracle/types";

type Wallet = { id: string; address: string; label: string | null; notification_email: string | null };
type Tier = "off" | "notify" | "confirm";
type PolicyRow = { rule_id: RuleId; tier: Tier; threshold: Record<string, unknown> };

const RULE_ORDER: RuleId[] = ["R1", "R2", "R3", "R4", "R5", "R6"];

// Confirm only means anything for R1/R6 — those are the only rules with a
// one-tap revoke action wired up (RevokeButton on Timeline). Offering it as
// a real choice for R2-R5, where it has no additional effect over Notify
// today, would be dishonest — so it's just not an option there.
const REVOKABLE_RULES: RuleId[] = ["R1", "R6"];
function tiersFor(ruleId: RuleId): Tier[] {
  return REVOKABLE_RULES.includes(ruleId) ? ["off", "notify", "confirm"] : ["off", "notify"];
}

const TIER_DESCRIPTIONS: Record<Tier, string> = {
  off: "This rule never fires for this wallet — no Moment, no email.",
  notify: "You get a Moment and an email when this fires. No in-app action beyond acknowledging or dismissing it.",
  confirm: "Everything Notify does, plus a one-tap revoke button right on the Moment in Timeline.",
};

function GuardrailsContent() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  // Without this, "no wallets yet" and "haven't fetched wallets yet" were
  // both just wallets.length === 0 — and since the policies fetch below is
  // gated on selectedWalletId (which never gets set with zero wallets),
  // the page was stuck on "Loading..." forever for anyone signed in who
  // hadn't registered a wallet, instead of the same "register one" prompt
  // Timeline already shows for the same situation.
  const [walletsLoaded, setWalletsLoaded] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[] | null>(null);
  const [floorMon, setFloorMon] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const authedFetch = useAuthedFetch();

  useEffect(() => {
    authedFetch("/api/wallets")
      .then((res) => res.json())
      .then((body: { wallets?: Wallet[] }) => {
        const list = body.wallets ?? [];
        setWallets(list);
        setSelectedWalletId((current) => current ?? list[0]?.id ?? null);
      })
      .catch(() => setError("Failed to load wallets."))
      .finally(() => setWalletsLoaded(true));
  }, [authedFetch]);

  useEffect(() => {
    const wallet = wallets.find((w) => w.id === selectedWalletId);
    setNotificationEmail(wallet?.notification_email ?? "");
  }, [selectedWalletId, wallets]);

  useEffect(() => {
    if (!selectedWalletId) return;
    setPolicies(null);
    authedFetch(`/api/policies?wallet=${selectedWalletId}`)
      .then((res) => res.json())
      .then((body: { policies?: PolicyRow[] }) => {
        const rows = body.policies ?? [];
        setPolicies(rows);
        const r5 = rows.find((p) => p.rule_id === "R5");
        const floorNative = r5?.threshold?.floorNative;
        setFloorMon(typeof floorNative === "string" ? formatEther(BigInt(floorNative)) : "");
      })
      .catch(() => setError("Failed to load guardrails."));
  }, [selectedWalletId, authedFetch]);

  function setTier(ruleId: RuleId, tier: Tier) {
    setPolicies((prev) => prev?.map((p) => (p.rule_id === ruleId ? { ...p, tier } : p)) ?? null);
  }

  const save = useCallback(async () => {
    if (!policies || !selectedWalletId) return;
    setStatus("saving");
    setError(null);

    let floorNative: string | undefined;
    if (floorMon.trim()) {
      try {
        floorNative = parseEther(floorMon.trim()).toString();
      } catch {
        setError("Floor must be a valid MON amount, e.g. 0.5");
        setStatus("idle");
        return;
      }
    }

    const trimmedEmail = notificationEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Notification email doesn't look valid.");
      setStatus("idle");
      return;
    }

    const payload = policies.map((p) => ({
      ruleId: p.rule_id,
      tier: p.tier,
      threshold: p.rule_id === "R5" ? { ...p.threshold, ...(floorNative ? { floorNative } : {}) } : p.threshold,
    }));

    try {
      const [policiesRes, walletRes] = await Promise.all([
        authedFetch(`/api/policies?wallet=${selectedWalletId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policies: payload }),
        }),
        authedFetch(`/api/wallets/${selectedWalletId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationEmail: trimmedEmail || null }),
        }),
      ]);
      if (!policiesRes.ok || !walletRes.ok) throw new Error("save failed");
      setWallets((prev) =>
        prev.map((w) => (w.id === selectedWalletId ? { ...w, notification_email: trimmedEmail || null } : w)),
      );
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setError("Couldn't save guardrails. Try again.");
      setStatus("idle");
    }
  }, [policies, selectedWalletId, floorMon, notificationEmail, authedFetch]);

  return (
    <div className="flex flex-col gap-6">
      <WalletSelect wallets={wallets} selectedWalletId={selectedWalletId} onChange={setSelectedWalletId} />

      {error && <p className="font-body text-sm text-danger">{error}</p>}

      {!walletsLoaded ? (
        <p className="font-body text-dim">Loading...</p>
      ) : wallets.length === 0 ? (
        <p className="font-body text-dim">
          No wallet registered yet. <BackLink href="/dashboard" label="Register one" />
        </p>
      ) : policies === null ? (
        <p className="font-body text-dim">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Panel className="flex flex-col gap-2">
            <p className="font-technical text-[11px] uppercase tracking-widest text-dim">What each tier does</p>
            <dl className="flex flex-col gap-1.5 font-body text-sm">
              {(["off", "notify", "confirm"] as Tier[]).map((tier) => (
                <div key={tier} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="w-20 shrink-0 font-technical text-xs uppercase tracking-wide text-brass">{tier}</dt>
                  <dd className="text-dim">{TIER_DESCRIPTIONS[tier]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-1 font-body text-xs text-dim">
              Confirm is only offered for Risky Approval and NFT Approval Risk — the other rules don&apos;t have a
              revoke action to enable yet.
            </p>
          </Panel>

          <Panel as="label" className="flex flex-col gap-1 font-body text-sm text-dim">
            Notification email — Notify/Confirm-tier Moments email here. Leave blank to get in-app only.
            <input
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full max-w-sm border border-paper/15 bg-ink px-2 py-1 font-technical text-sm text-paper"
            />
          </Panel>

          {RULE_ORDER.map((ruleId) => {
            const policy = policies.find((p) => p.rule_id === ruleId);
            if (!policy) return null;
            return (
              <Panel key={ruleId} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg text-paper">{RULE_LABELS[ruleId]}</span>
                  <div className="flex gap-1">
                    {tiersFor(ruleId).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setTier(ruleId, tier)}
                        title={TIER_DESCRIPTIONS[tier]}
                        className={`px-2 py-1 font-technical text-xs uppercase tracking-wide ${
                          policy.tier === tier ? "bg-brass text-ink" : "border border-paper/20 text-dim"
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                {ruleId === "R5" && (
                  <label className="font-body text-sm text-dim">
                    Floor (MON) — flag when native balance drops below this
                    <input
                      value={floorMon}
                      onChange={(e) => setFloorMon(e.target.value)}
                      placeholder="e.g. 0.5"
                      className="mt-1 block w-40 border border-paper/15 bg-ink px-2 py-1 font-technical text-sm text-paper"
                    />
                  </label>
                )}
              </Panel>
            );
          })}

          <p className="font-body text-xs text-dim">
            Marking a recurring payment (R3) as intentional isn&apos;t configurable here yet — detection is live, but
            there&apos;s no UI action to acknowledge a specific pattern, so it keeps surfacing until it stops
            recurring. Per-rule tier and the R5 floor above are live.
          </p>

          <Button onClick={save} disabled={status === "saving"} className="w-fit">
            {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save guardrails"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function GuardrailsPage() {
  return (
    <div className="min-h-screen bg-ink">
      <AppHeader />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl text-paper">Guardrails</h1>
          <BackLink history label="Back" />
        </div>
        <AuthGate>
          <GuardrailsContent />
        </AuthGate>
      </main>
    </div>
  );
}
